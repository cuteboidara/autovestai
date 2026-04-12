"""Parser for the AutovestAI contract-specification PDF text."""

from __future__ import annotations

from dataclasses import dataclass
import re

from app.models import ParsedPdfAsset
from app.normalization import normalize_symbol_key


ROW_PATTERN = re.compile(
    r"^(?P<symbol>\S+)\s+"
    r"(?P<description>.+?)\s+"
    r"(?P<margin_retail>\d+(?:\.\d+)?%)\s+"
    r"(?P<margin_pro>\d+(?:\.\d+)?%)\s+"
    r"(?P<lot_size>[\d,]+)\s+"
    r"(?P<pip_value>.+?)\s+"
    r"(?P<swap_long>-?\d+(?:\.\d+)?)\s+"
    r"(?P<swap_short>-?\d+(?:\.\d+)?)\s+"
    r"(?P<digits>\d+)\s+"
    r"(?P<tick>\d+(?:\.\d+)?)\s+"
    r"(?P<min_lots>\d+(?:\.\d+)?)\s+"
    r"(?P<max_lots>\d+(?:\.\d+)?)\s+"
    r"(?P<hours>.+)$"
)


@dataclass(frozen=True, slots=True)
class SectionDefinition:
    """PDF section metadata used during parsing."""

    label: str
    pattern: re.Pattern[str]
    asset_class: str
    subtype: str | None
    region: str | None


SECTION_DEFINITIONS: tuple[SectionDefinition, ...] = (
    SectionDefinition("FOREX", re.compile(r"^FOREX Trading Hours"), "FOREX", "spot_fx", None),
    SectionDefinition("METALS", re.compile(r"^METALS Trading Hours"), "METALS", "spot_metal", None),
    SectionDefinition("INDICES", re.compile(r"^INDICES Trading Hours"), "INDICES", "index_cfd", None),
    SectionDefinition(
        "COMMODITIES",
        re.compile(r"^COMMODITIES Trading Hours"),
        "COMMODITIES",
        "commodity_cfd",
        None,
    ),
    SectionDefinition("CRYPTO", re.compile(r"^CRYPTO Trading Hours"), "CRYPTO", "crypto_spot", None),
    SectionDefinition("STOCKS US", re.compile(r"^STOCKS US Trading Hours"), "STOCKS", "equity", "US"),
    SectionDefinition("ETFS", re.compile(r"^ETFs Trading Hours"), "ETFS", "etf", "US"),
    SectionDefinition("STOCKS EU", re.compile(r"^STOCKS EU Trading Hours"), "STOCKS", "equity", "EU"),
    SectionDefinition("STOCKS UK", re.compile(r"^STOCKS UK Trading Hours"), "STOCKS", "equity", "UK"),
    SectionDefinition(
        "STOCKS MIDEAST",
        re.compile(r"^STOCKS MIDEAST Trading Hours"),
        "STOCKS",
        "equity",
        "MIDEAST",
    ),
    SectionDefinition(
        "STOCKS LATAM",
        re.compile(r"^STOCKS LATAM Trading Hours"),
        "STOCKS",
        "equity",
        "LATAM",
    ),
    SectionDefinition("STOCKS ROW", re.compile(r"^STOCKS ROW Trading Hours"), "STOCKS", "equity", "ROW"),
)


class ContractSpecificationsParser:
    """Parse raw PDF text into contract rows."""

    def parse_text(self, text: str) -> list[ParsedPdfAsset]:
        """Parse raw PDF text into structured rows."""

        lines = [line.strip() for line in text.splitlines()]
        rows: list[tuple[SectionDefinition, str]] = []
        current_section: SectionDefinition | None = None
        buffer = ""

        def flush() -> None:
            nonlocal buffer
            if current_section and buffer:
                rows.append((current_section, buffer.strip()))
            buffer = ""

        for line in lines:
            section = next(
                (definition for definition in SECTION_DEFINITIONS if definition.pattern.search(line)),
                None,
            )
            if section:
                flush()
                current_section = section
                continue

            if not current_section or self._is_noise_line(line):
                continue

            if self._looks_like_row_start(line):
                flush()
                buffer = line
                continue

            if buffer:
                buffer = f"{buffer} {line}".strip()

        flush()

        return [self._parse_row(section, row_text) for section, row_text in rows]

    def _parse_row(self, section: SectionDefinition, row_text: str) -> ParsedPdfAsset:
        match = ROW_PATTERN.match(row_text)
        if not match:
            raise ValueError(f"Unable to parse contract row: {row_text}")

        groups = match.groupdict()
        return ParsedPdfAsset(
            raw_pdf_symbol=groups["symbol"],
            normalized_symbol_key=normalize_symbol_key(groups["symbol"]),
            pdf_section=section.label,
            asset_class=section.asset_class,
            subtype=section.subtype,
            region=section.region,
            description=groups["description"].strip(),
            margin_retail_pct=self._percent_to_float(groups["margin_retail"]),
            margin_pro_pct=self._percent_to_float(groups["margin_pro"]),
            lot_size=self._number_to_float(groups["lot_size"]),
            pip_value=groups["pip_value"].strip(),
            swap_long=float(groups["swap_long"]),
            swap_short=float(groups["swap_short"]),
            digits=int(groups["digits"]),
            min_tick_increment=float(groups["tick"]),
            min_trade_size_lots=float(groups["min_lots"]),
            max_trade_size_lots=float(groups["max_lots"]),
            trading_hours=groups["hours"].strip(),
        )

    def _looks_like_row_start(self, line: str) -> bool:
        return bool(re.match(r"^[A-Za-z0-9][A-Za-z0-9.-]*\s+", line))

    def _is_noise_line(self, line: str) -> bool:
        return bool(
            not line
            or re.match(r"^--- \d+ / \d+ ---$", line)
            or line.startswith("Symbol Market Description")
            or line.startswith("(Units)")
            or line.startswith("Lot Value per Pip")
            or line.startswith("Silver Tier")
            or line.startswith("Swap Long")
            or line.startswith("Swap Short")
            or line.startswith("Digits Min Tick")
            or line.startswith("Increment")
            or line.startswith("Min Trade Size")
            or line.startswith("Max Trade Size")
            or line in {"Sunday Monday - Thursday Friday", "Monday - Friday", "Monday - Sunday"}
        )

    def _percent_to_float(self, value: str) -> float:
        return float(value.replace("%", ""))

    def _number_to_float(self, value: str) -> float:
        return float(value.replace(",", ""))

