"""Instrument resolver that maps parsed PDF rows into a canonical registry."""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any

from app.mapping.alias_catalog import (
    AliasRecord,
    COMMODITY_ALIASES,
    CRYPTO_BINANCE_SYMBOLS,
    CRYPTO_COIN_IDS,
    EU_STOCK_ALIASES,
    INDEX_ALIASES,
    LATAM_STOCK_ALIASES,
    METAL_ALIASES,
    MIDEAST_EXPLICIT_ALIASES,
    MIDEAST_OMAN_SYMBOLS,
    MIDEAST_QATAR_SYMBOLS,
    MIDEAST_UAE_ADX_SYMBOLS,
    MIDEAST_UAE_DFM_SYMBOLS,
    ROW_STOCK_ALIASES,
    UK_STOCK_ALIASES,
    US_STOCK_ALIASES,
)
from app.models import InstrumentRegistryEntry, ParsedPdfAsset
from app.normalization import (
    build_internal_id,
    infer_quote_currency_from_pip_value,
    normalize_symbol_key,
    split_quote_suffix,
    split_six_character_pair,
)


def derive_default_spread(asset_class: str, min_tick_increment: float) -> float:
    """Replicate the backend's spread heuristics for seeded symbols."""

    if asset_class == "FOREX":
        return min_tick_increment * 20
    if asset_class == "METALS":
        return min_tick_increment * 10
    if asset_class == "INDICES":
        return min_tick_increment * 5
    if asset_class == "COMMODITIES":
        return min_tick_increment * 4
    if asset_class == "CRYPTO":
        return min_tick_increment * 20
    return max(min_tick_increment * 2, 0.02)


@dataclass(slots=True)
class ActivationResolver:
    """Resolve parsed contract rows into canonical instrument entries."""

    def resolve_many(self, assets: list[ParsedPdfAsset]) -> list[InstrumentRegistryEntry]:
        """Resolve a full parsed universe."""

        return [self.resolve_asset(asset) for asset in assets]

    def resolve_asset(self, asset: ParsedPdfAsset) -> InstrumentRegistryEntry:
        """Resolve a single parsed PDF asset."""

        if asset.asset_class == "FOREX":
            return self._resolve_forex(asset)
        if asset.asset_class == "CRYPTO":
            return self._resolve_crypto(asset)
        if asset.asset_class == "METALS":
            return self._resolve_proxy_asset(asset, METAL_ALIASES[asset.normalized_symbol_key], "active")
        if asset.asset_class == "INDICES":
            return self._resolve_proxy_asset(asset, INDEX_ALIASES[asset.normalized_symbol_key], "partial")
        if asset.asset_class == "COMMODITIES":
            return self._resolve_proxy_asset(asset, COMMODITY_ALIASES[asset.normalized_symbol_key], "partial")
        if asset.asset_class == "ETFS":
            return self._resolve_etf(asset)
        if asset.pdf_section == "STOCKS US":
            return self._resolve_us_equity(asset)
        if asset.pdf_section == "STOCKS EU":
            return self._resolve_international_equity(asset, EU_STOCK_ALIASES)
        if asset.pdf_section == "STOCKS UK":
            return self._resolve_international_equity(asset, UK_STOCK_ALIASES)
        if asset.pdf_section == "STOCKS LATAM":
            return self._resolve_international_equity(asset, LATAM_STOCK_ALIASES)
        if asset.pdf_section == "STOCKS ROW":
            return self._resolve_international_equity(asset, ROW_STOCK_ALIASES)
        if asset.pdf_section == "STOCKS MIDEAST":
            return self._resolve_mideast_equity(asset)
        return self._unresolved_entry(asset, "No resolver matched this PDF section.")

    def _resolve_forex(self, asset: ParsedPdfAsset) -> InstrumentRegistryEntry:
        base, quote = split_six_character_pair(asset.raw_pdf_symbol)
        canonical_symbol = f"{base}/{quote}"
        provider_map = {
            "exchange_rate_host": {"symbol": canonical_symbol},
            "twelve_data": {"symbol": canonical_symbol},
            "alpha_vantage": {"from_symbol": base, "to_symbol": quote},
            "yahoo_finance": {"symbol": f"{base}{quote}=X"},
        }
        return self._build_entry(
            asset,
            canonical_symbol=canonical_symbol,
            display_symbol=canonical_symbol,
            name=asset.description,
            exchange="OTC FX",
            country=None,
            region="GLOBAL",
            base_currency=base,
            quote_currency=quote,
            provider_symbol_map=provider_map,
            status="active",
            confidence="exact_match",
            backend_quote_source="FOREX_API",
            backend_quote_symbol=normalize_symbol_key(asset.raw_pdf_symbol),
        )

    def _resolve_crypto(self, asset: ParsedPdfAsset) -> InstrumentRegistryEntry:
        base, quote = split_quote_suffix(asset.raw_pdf_symbol, "USD")
        normalized = normalize_symbol_key(asset.raw_pdf_symbol)
        canonical_symbol = f"{base}/{quote}"
        yahoo_symbol = f"{base}-USD"
        provider_map: dict[str, dict[str, Any]] = {
            "yahoo_finance": {"symbol": yahoo_symbol},
            "twelve_data": {"symbol": canonical_symbol},
        }
        coin_id = CRYPTO_COIN_IDS.get(normalized)
        if coin_id:
            provider_map["coingecko"] = {"id": coin_id, "vs_currency": "usd"}
        binance_symbol = CRYPTO_BINANCE_SYMBOLS.get(normalized)
        if binance_symbol:
            provider_map["binance"] = {"symbol": binance_symbol}

        status = "partial" if normalized == "TRUMPUSD" else "active"
        confidence = "heuristic_match" if normalized == "TRUMPUSD" else "exact_match"
        notes: list[str] = []
        if normalized == "TRUMPUSD":
            notes.append("Memecoin coverage varies across free providers; review live routing before production use.")

        preferred_source = "BINANCE" if "binance" in provider_map else "YAHOO"
        preferred_symbol = (
            provider_map["binance"]["symbol"].lower()
            if preferred_source == "BINANCE"
            else yahoo_symbol
        )
        return self._build_entry(
            asset,
            canonical_symbol=canonical_symbol,
            display_symbol=canonical_symbol,
            name=asset.description,
            exchange="CRYPTO",
            country=None,
            region="GLOBAL",
            base_currency=base,
            quote_currency=quote,
            provider_symbol_map=provider_map,
            status=status,
            confidence=confidence,
            notes=notes,
            backend_quote_source=preferred_source,
            backend_quote_symbol=preferred_symbol,
        )

    def _resolve_proxy_asset(
        self,
        asset: ParsedPdfAsset,
        record: AliasRecord,
        status: str,
    ) -> InstrumentRegistryEntry:
        provider_map = self._provider_map_from_record(record, include_public_equity_apis=False)
        base_currency = None
        quote_currency = infer_quote_currency_from_pip_value(asset.pip_value)
        if asset.normalized_symbol_key in {"XAUUSD", "XAGUSD", "XPDUSD", "XPTUSD"}:
            base_currency, quote_currency = split_six_character_pair(asset.raw_pdf_symbol)
        notes = list(record.notes)
        if status == "partial":
            notes.append("Uses documented free-market benchmark or futures proxy for the broker CFD.")
        return self._build_entry(
            asset,
            canonical_symbol=record.canonical_symbol,
            display_symbol=record.display_symbol or record.canonical_symbol,
            name=asset.description,
            exchange=record.exchange or "Benchmark/Proxy",
            country=record.country,
            region=record.region or "GLOBAL",
            base_currency=base_currency,
            quote_currency=quote_currency,
            provider_symbol_map=provider_map,
            status=status,
            confidence=record.confidence,
            notes=notes,
            backend_quote_source="YAHOO",
            backend_quote_symbol=record.yahoo_symbol or asset.raw_pdf_symbol,
        )

    def _resolve_etf(self, asset: ParsedPdfAsset) -> InstrumentRegistryEntry:
        symbol = normalize_symbol_key(asset.raw_pdf_symbol)
        provider_map = {
            "yahoo_finance": {"symbol": symbol},
            "twelve_data": {"symbol": symbol},
            "alpha_vantage": {"symbol": symbol},
            "financial_modeling_prep": {"symbol": symbol},
            "stooq": {"symbol": f"{symbol.lower()}.us"},
        }
        return self._build_entry(
            asset,
            canonical_symbol=symbol,
            display_symbol=symbol,
            name=asset.description,
            exchange="NYSE Arca/Nasdaq",
            country="United States",
            region="US",
            base_currency=None,
            quote_currency="USD",
            provider_symbol_map=provider_map,
            status="active",
            confidence="exact_match",
            backend_quote_source="YAHOO",
            backend_quote_symbol=symbol,
        )

    def _resolve_us_equity(self, asset: ParsedPdfAsset) -> InstrumentRegistryEntry:
        normalized = asset.normalized_symbol_key
        record = US_STOCK_ALIASES.get(normalized)
        yahoo_symbol = record.yahoo_symbol if record else normalized
        display_symbol = record.display_symbol if record and record.display_symbol else yahoo_symbol
        provider_map = {
            "yahoo_finance": {"symbol": yahoo_symbol},
            "twelve_data": {"symbol": record.twelve_data_symbol if record and record.twelve_data_symbol else yahoo_symbol},
            "alpha_vantage": {"symbol": record.alpha_vantage_symbol if record and record.alpha_vantage_symbol else yahoo_symbol},
            "financial_modeling_prep": {"symbol": record.fmp_symbol if record and record.fmp_symbol else yahoo_symbol},
            "stooq": {"symbol": record.stooq_symbol if record and record.stooq_symbol else f"{yahoo_symbol.lower()}.us"},
        }
        confidence = record.confidence if record else "exact_match"
        notes = list(record.notes) if record else []
        status = "partial" if confidence == "heuristic_match" else "active"
        return self._build_entry(
            asset,
            canonical_symbol=record.canonical_symbol if record else normalized,
            display_symbol=display_symbol,
            name=asset.description,
            exchange=record.exchange if record and record.exchange else "NYSE/Nasdaq",
            country=record.country if record and record.country else "United States",
            region="US",
            base_currency=None,
            quote_currency="USD",
            provider_symbol_map=provider_map,
            status=status,
            confidence=confidence,
            notes=notes,
            backend_quote_source="YAHOO",
            backend_quote_symbol=yahoo_symbol,
        )

    def _resolve_international_equity(
        self,
        asset: ParsedPdfAsset,
        alias_map: dict[str, AliasRecord],
    ) -> InstrumentRegistryEntry:
        record = alias_map.get(asset.normalized_symbol_key)
        if not record:
            return self._unresolved_entry(asset, "No international-equity alias record was found.")

        provider_map = self._provider_map_from_record(record)
        return self._build_entry(
            asset,
            canonical_symbol=record.canonical_symbol,
            display_symbol=record.display_symbol or record.canonical_symbol,
            name=self._clean_name(asset.description),
            exchange=record.exchange,
            country=record.country,
            region=record.region,
            base_currency=None,
            quote_currency=infer_quote_currency_from_pip_value(asset.pip_value),
            provider_symbol_map=provider_map,
            status="active",
            confidence=record.confidence,
            notes=list(record.notes),
            backend_quote_source="YAHOO",
            backend_quote_symbol=record.yahoo_symbol or record.canonical_symbol,
        )

    def _resolve_mideast_equity(self, asset: ParsedPdfAsset) -> InstrumentRegistryEntry:
        normalized = asset.normalized_symbol_key
        explicit = MIDEAST_EXPLICIT_ALIASES.get(normalized)
        if explicit:
            provider_map = self._provider_map_from_record(explicit, include_public_equity_apis=False)
            return self._build_entry(
                asset,
                canonical_symbol=explicit.canonical_symbol,
                display_symbol=explicit.display_symbol or explicit.canonical_symbol,
                name=self._clean_name(asset.description),
                exchange=explicit.exchange,
                country=explicit.country,
                region="MIDEAST",
                base_currency=None,
                quote_currency=infer_quote_currency_from_pip_value(asset.pip_value),
                provider_symbol_map=provider_map,
                status="partial",
                confidence=explicit.confidence,
                notes=list(explicit.notes),
                backend_quote_source="YAHOO",
                backend_quote_symbol=explicit.yahoo_symbol or explicit.canonical_symbol,
            )

        explicit_symbol = self._extract_explicit_exchange_symbol(asset.description)
        if explicit_symbol:
            return self._build_entry(
                asset,
                canonical_symbol=explicit_symbol,
                display_symbol=explicit_symbol,
                name=self._clean_name(asset.description),
                exchange=self._exchange_from_suffix(explicit_symbol),
                country="Saudi Arabia",
                region="MIDEAST",
                base_currency=None,
                quote_currency=infer_quote_currency_from_pip_value(asset.pip_value),
                provider_symbol_map={
                    "yahoo_finance": {"symbol": explicit_symbol},
                    "twelve_data": {"symbol": explicit_symbol},
                },
                status="active",
                confidence="exact_match",
                backend_quote_source="YAHOO",
                backend_quote_symbol=explicit_symbol,
            )

        if normalized in MIDEAST_UAE_ADX_SYMBOLS:
            return self._resolve_heuristic_mideast(asset, f"{normalized}.AD", "ADX", "United Arab Emirates")
        if normalized in MIDEAST_UAE_DFM_SYMBOLS:
            return self._resolve_heuristic_mideast(asset, f"{normalized}.DU", "DFM", "United Arab Emirates")
        if normalized in MIDEAST_QATAR_SYMBOLS:
            return self._resolve_heuristic_mideast(asset, f"{normalized}.QA", "QSE", "Qatar")
        if normalized in MIDEAST_OMAN_SYMBOLS:
            return self._resolve_heuristic_mideast(asset, f"{normalized}.OM", "MSX", "Oman")

        return self._unresolved_entry(asset, "No clean free-provider mapping was inferred for this Mideast symbol.")

    def _resolve_heuristic_mideast(
        self,
        asset: ParsedPdfAsset,
        canonical_symbol: str,
        exchange: str,
        country: str,
    ) -> InstrumentRegistryEntry:
        return self._build_entry(
            asset,
            canonical_symbol=canonical_symbol,
            display_symbol=canonical_symbol,
            name=self._clean_name(asset.description),
            exchange=exchange,
            country=country,
            region="MIDEAST",
            base_currency=None,
            quote_currency=infer_quote_currency_from_pip_value(asset.pip_value),
            provider_symbol_map={
                "yahoo_finance": {"symbol": canonical_symbol},
                "twelve_data": {"symbol": canonical_symbol},
            },
            status="partial",
            confidence="heuristic_match",
            notes=["Exchange suffix inferred from PDF region/venue conventions; confirm live provider support before routing trades."],
            backend_quote_source="YAHOO",
            backend_quote_symbol=canonical_symbol,
        )

    def _provider_map_from_record(
        self,
        record: AliasRecord,
        *,
        include_public_equity_apis: bool = True,
    ) -> dict[str, dict[str, Any]]:
        provider_map: dict[str, dict[str, Any]] = {}
        if record.yahoo_symbol:
            provider_map["yahoo_finance"] = {"symbol": record.yahoo_symbol}
        if record.twelve_data_symbol:
            provider_map["twelve_data"] = {"symbol": record.twelve_data_symbol}
        if include_public_equity_apis and record.alpha_vantage_symbol:
            provider_map["alpha_vantage"] = {"symbol": record.alpha_vantage_symbol}
        if include_public_equity_apis and record.fmp_symbol:
            provider_map["financial_modeling_prep"] = {"symbol": record.fmp_symbol}
        if record.stooq_symbol:
            provider_map["stooq"] = {"symbol": record.stooq_symbol}
        if record.binance_symbol:
            provider_map["binance"] = {"symbol": record.binance_symbol}
        if record.coingecko_id:
            provider_map["coingecko"] = {"id": record.coingecko_id, "vs_currency": "usd"}
        return provider_map

    def _build_entry(
        self,
        asset: ParsedPdfAsset,
        *,
        canonical_symbol: str,
        display_symbol: str,
        name: str,
        exchange: str | None,
        country: str | None,
        region: str | None,
        base_currency: str | None,
        quote_currency: str | None,
        provider_symbol_map: dict[str, dict[str, Any]],
        status: str,
        confidence: str,
        backend_quote_source: str,
        backend_quote_symbol: str,
        notes: list[str] | None = None,
    ) -> InstrumentRegistryEntry:
        supported_providers = sorted(provider_symbol_map.keys())
        backend_seed = {
            "symbol": normalize_symbol_key(asset.raw_pdf_symbol),
            "description": asset.description,
            "category": asset.asset_class,
            "market_group": asset.region,
            "lot_size": asset.lot_size,
            "margin_retail_pct": asset.margin_retail_pct,
            "margin_pro_pct": asset.margin_pro_pct,
            "swap_long": asset.swap_long,
            "swap_short": asset.swap_short,
            "digits": asset.digits,
            "min_tick_increment": asset.min_tick_increment,
            "min_trade_size_lots": asset.min_trade_size_lots,
            "max_trade_size_lots": asset.max_trade_size_lots,
            "pip_value": asset.pip_value,
            "trading_hours": asset.trading_hours,
            "default_spread": derive_default_spread(asset.asset_class, asset.min_tick_increment),
            "quote_source": backend_quote_source,
            "quote_symbol": backend_quote_symbol,
            "enabled": status != "unresolved",
            "is_active": status != "unresolved",
        }
        metadata = {
            "pdf_section": asset.pdf_section,
            "broker_description": asset.description,
            "contract_spec": {
                "margin_retail_pct": asset.margin_retail_pct,
                "margin_pro_pct": asset.margin_pro_pct,
                "lot_size": asset.lot_size,
                "pip_value": asset.pip_value,
                "swap_long": asset.swap_long,
                "swap_short": asset.swap_short,
                "digits": asset.digits,
                "min_tick_increment": asset.min_tick_increment,
                "min_trade_size_lots": asset.min_trade_size_lots,
                "max_trade_size_lots": asset.max_trade_size_lots,
                "trading_hours": asset.trading_hours,
            },
        }
        return InstrumentRegistryEntry(
            internal_id=build_internal_id(asset.asset_class.lower(), canonical_symbol),
            raw_pdf_symbol=asset.raw_pdf_symbol,
            canonical_symbol=canonical_symbol,
            display_symbol=display_symbol,
            name=name,
            asset_class=asset.asset_class,
            subtype=asset.subtype,
            region=region,
            exchange=exchange,
            country=country,
            base_currency=base_currency,
            quote_currency=quote_currency,
            provider_symbol_map=provider_symbol_map,
            supported_providers=supported_providers,
            status=status,  # type: ignore[arg-type]
            notes=notes or [],
            metadata=metadata,
            confidence=confidence,  # type: ignore[arg-type]
            backend_seed=backend_seed,
        )

    def _unresolved_entry(self, asset: ParsedPdfAsset, reason: str) -> InstrumentRegistryEntry:
        return self._build_entry(
            asset,
            canonical_symbol=normalize_symbol_key(asset.raw_pdf_symbol),
            display_symbol=normalize_symbol_key(asset.raw_pdf_symbol),
            name=self._clean_name(asset.description),
            exchange=None,
            country=None,
            region=asset.region,
            base_currency=None,
            quote_currency=infer_quote_currency_from_pip_value(asset.pip_value),
            provider_symbol_map={},
            status="unresolved",
            confidence="unresolved",
            notes=[reason],
            backend_quote_source="MANUAL",
            backend_quote_symbol=normalize_symbol_key(asset.raw_pdf_symbol),
        )

    def _extract_explicit_exchange_symbol(self, description: str) -> str | None:
        match = re.search(r"\((?P<ticker>[^)]+\.[A-Z]{2,3})\)", description)
        if not match:
            return None
        return normalize_symbol_key(match.group("ticker"))

    def _exchange_from_suffix(self, symbol: str) -> str:
        suffix = symbol.rsplit(".", 1)[-1]
        return {
            "SR": "Saudi Exchange",
            "AD": "ADX",
            "DU": "DFM",
            "QA": "QSE",
            "OM": "MSX",
            "KW": "Boursa Kuwait",
        }.get(suffix, suffix)

    def _clean_name(self, description: str) -> str:
        return re.sub(r"\s*\([^)]+\)\s*$", "", description).strip()
