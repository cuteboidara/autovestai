"""Dataclasses representing parsed contract rows and activated instruments."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal


MappingConfidence = Literal[
    "exact_match",
    "high_confidence_alias",
    "heuristic_match",
    "unresolved",
]

ActivationStatus = Literal["active", "partial", "unresolved"]


@dataclass(slots=True)
class ParsedPdfAsset:
    """A raw instrument row extracted from the contract-specification PDF."""

    raw_pdf_symbol: str
    normalized_symbol_key: str
    pdf_section: str
    asset_class: str
    subtype: str | None
    region: str | None
    description: str
    margin_retail_pct: float
    margin_pro_pct: float
    lot_size: float
    pip_value: str
    swap_long: float
    swap_short: float
    digits: int
    min_tick_increment: float
    min_trade_size_lots: float
    max_trade_size_lots: float
    trading_hours: str

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-safe dictionary."""

        return asdict(self)


@dataclass(slots=True)
class InstrumentRegistryEntry:
    """A normalized registry entry suitable for quotes, charts, and scanners."""

    internal_id: str
    raw_pdf_symbol: str
    canonical_symbol: str
    display_symbol: str
    name: str
    asset_class: str
    subtype: str | None
    region: str | None
    exchange: str | None
    country: str | None
    base_currency: str | None
    quote_currency: str | None
    provider_symbol_map: dict[str, dict[str, Any]]
    supported_providers: list[str]
    status: ActivationStatus
    notes: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    confidence: MappingConfidence = "unresolved"
    backend_seed: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-safe dictionary."""

        return asdict(self)


@dataclass(slots=True)
class ActivationReport:
    """Summary metadata for a full activation run."""

    source_pdf: str
    generated_at: str
    total_assets_found_in_pdf: int
    total_resolved: int
    total_partially_resolved: int
    total_unresolved: int
    counts_by_asset_class: dict[str, int]
    counts_by_pdf_section: dict[str, int]
    counts_by_provider: dict[str, int]
    counts_by_runtime_source: dict[str, int]
    duplicate_rows_merged: int
    ambiguous_mappings_requiring_manual_review: list[str]
    exact_list_of_unresolved_raw_pdf_symbol_values: list[str]

    @classmethod
    def build(
        cls,
        *,
        source_pdf: str,
        total_assets_found_in_pdf: int,
        total_resolved: int,
        total_partially_resolved: int,
        total_unresolved: int,
        counts_by_asset_class: dict[str, int],
        counts_by_pdf_section: dict[str, int],
        counts_by_provider: dict[str, int],
        counts_by_runtime_source: dict[str, int],
        duplicate_rows_merged: int,
        ambiguous_mappings_requiring_manual_review: list[str],
        exact_list_of_unresolved_raw_pdf_symbol_values: list[str],
    ) -> "ActivationReport":
        """Construct a report with a deterministic UTC timestamp."""

        return cls(
            source_pdf=source_pdf,
            generated_at=datetime.now(timezone.utc).isoformat(),
            total_assets_found_in_pdf=total_assets_found_in_pdf,
            total_resolved=total_resolved,
            total_partially_resolved=total_partially_resolved,
            total_unresolved=total_unresolved,
            counts_by_asset_class=counts_by_asset_class,
            counts_by_pdf_section=counts_by_pdf_section,
            counts_by_provider=counts_by_provider,
            counts_by_runtime_source=counts_by_runtime_source,
            duplicate_rows_merged=duplicate_rows_merged,
            ambiguous_mappings_requiring_manual_review=ambiguous_mappings_requiring_manual_review,
            exact_list_of_unresolved_raw_pdf_symbol_values=exact_list_of_unresolved_raw_pdf_symbol_values,
        )

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-safe dictionary."""

        return asdict(self)

