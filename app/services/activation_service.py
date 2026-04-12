"""Service orchestration for full asset activation runs."""

from __future__ import annotations

from collections import Counter
import csv
import json
import logging
from pathlib import Path

from app.config import ActivationSettings
from app.models import ActivationReport, InstrumentRegistryEntry, ParsedPdfAsset
from app.parsing.contract_specifications_parser import ContractSpecificationsParser
from app.parsing.pdf_text_extractor import PdfTextExtractor
from app.mapping.resolver import ActivationResolver


LOGGER = logging.getLogger(__name__)


class AssetActivationService:
    """Parse the source PDF, resolve instruments, and emit output artifacts."""

    def __init__(self, settings: ActivationSettings) -> None:
        self.settings = settings
        self.extractor = PdfTextExtractor(settings)
        self.parser = ContractSpecificationsParser()
        self.resolver = ActivationResolver()

    def activate(self, pdf_path: Path, output_dir: Path | None = None) -> ActivationReport:
        """Run the full asset activation workflow."""

        resolved_output_dir = (output_dir or self.settings.output_dir).resolve()
        resolved_output_dir.mkdir(parents=True, exist_ok=True)

        pdf_text = self.extractor.extract_text(pdf_path)
        parsed_assets = self.parser.parse_text(pdf_text)
        deduped_assets, duplicate_rows_merged = self._dedupe_assets(parsed_assets)
        registry_entries = self.resolver.resolve_many(deduped_assets)
        report = self._build_report(
            pdf_path=pdf_path.resolve(),
            parsed_assets=parsed_assets,
            registry_entries=registry_entries,
            duplicate_rows_merged=duplicate_rows_merged,
        )

        self._write_json(resolved_output_dir / "parsed_pdf_assets.json", [item.to_dict() for item in parsed_assets])
        self._write_csv(resolved_output_dir / "parsed_pdf_assets.csv", [item.to_dict() for item in parsed_assets])
        self._write_json(resolved_output_dir / "instruments_master.json", [item.to_dict() for item in registry_entries])
        self._write_csv(resolved_output_dir / "instruments_master.csv", [item.to_dict() for item in registry_entries])
        unresolved = [
            item.to_dict()
            for item in registry_entries
            if item.status in {"partial", "unresolved"}
        ]
        self._write_json(resolved_output_dir / "unresolved_mappings.json", unresolved)
        self._write_json(resolved_output_dir / "activation_report.json", report.to_dict())
        LOGGER.info("Activation outputs written to %s", resolved_output_dir)
        return report

    def _dedupe_assets(self, assets: list[ParsedPdfAsset]) -> tuple[list[ParsedPdfAsset], int]:
        seen: dict[str, ParsedPdfAsset] = {}
        duplicates_merged = 0
        for asset in assets:
            key = f"{asset.pdf_section}:{asset.normalized_symbol_key}"
            if key in seen:
                duplicates_merged += 1
                continue
            seen[key] = asset
        return list(seen.values()), duplicates_merged

    def _build_report(
        self,
        *,
        pdf_path: Path,
        parsed_assets: list[ParsedPdfAsset],
        registry_entries: list[InstrumentRegistryEntry],
        duplicate_rows_merged: int,
    ) -> ActivationReport:
        counts_by_asset_class = Counter(entry.asset_class for entry in registry_entries)
        counts_by_pdf_section = Counter(asset.pdf_section for asset in parsed_assets)
        counts_by_provider = Counter(
            provider
            for entry in registry_entries
            for provider in entry.provider_symbol_map
        )
        counts_by_runtime_source = Counter(
            str(entry.backend_seed.get("quote_source", "MANUAL"))
            for entry in registry_entries
        )
        unresolved_symbols = [
            entry.raw_pdf_symbol
            for entry in registry_entries
            if entry.status == "unresolved"
        ]
        ambiguous = [
            entry.raw_pdf_symbol
            for entry in registry_entries
            if entry.status != "active" or entry.confidence == "heuristic_match"
        ]
        return ActivationReport.build(
            source_pdf=str(pdf_path),
            total_assets_found_in_pdf=len(parsed_assets),
            total_resolved=sum(1 for entry in registry_entries if entry.status == "active"),
            total_partially_resolved=sum(1 for entry in registry_entries if entry.status == "partial"),
            total_unresolved=sum(1 for entry in registry_entries if entry.status == "unresolved"),
            counts_by_asset_class=dict(sorted(counts_by_asset_class.items())),
            counts_by_pdf_section=dict(sorted(counts_by_pdf_section.items())),
            counts_by_provider=dict(sorted(counts_by_provider.items())),
            counts_by_runtime_source=dict(sorted(counts_by_runtime_source.items())),
            duplicate_rows_merged=duplicate_rows_merged,
            ambiguous_mappings_requiring_manual_review=sorted(ambiguous),
            exact_list_of_unresolved_raw_pdf_symbol_values=sorted(unresolved_symbols),
        )

    def _write_json(self, path: Path, payload: object) -> None:
        path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")

    def _write_csv(self, path: Path, rows: list[dict[str, object]]) -> None:
        if not rows:
            path.write_text("", encoding="utf-8")
            return

        field_names = sorted({key for row in rows for key in row.keys()})
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=field_names)
            writer.writeheader()
            for row in rows:
                serialized = {
                    key: self._serialize_csv_value(value)
                    for key, value in row.items()
                }
                writer.writerow(serialized)

    def _serialize_csv_value(self, value: object) -> str | int | float | None:
        if isinstance(value, (str, int, float)) or value is None:
            return value
        return json.dumps(value, sort_keys=True)

