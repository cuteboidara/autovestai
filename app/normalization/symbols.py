"""Utility helpers for symbol normalization."""

from __future__ import annotations

import re


def normalize_symbol_key(value: str) -> str:
    """Normalize a broker symbol into a stable lookup key."""

    return re.sub(r"\s+", "", str(value).strip()).upper()


def split_six_character_pair(symbol: str) -> tuple[str, str]:
    """Split a compact six-letter pair into base and quote currencies."""

    normalized = normalize_symbol_key(symbol)
    if len(normalized) != 6:
        raise ValueError(f"Expected a six-character pair, received: {symbol}")
    return normalized[:3], normalized[3:]


def split_quote_suffix(symbol: str, quote_currency: str) -> tuple[str, str]:
    """Split a symbol using a known quote-currency suffix."""

    normalized = normalize_symbol_key(symbol)
    if not normalized.endswith(quote_currency):
        raise ValueError(f"Expected {symbol} to end with {quote_currency}")
    return normalized[: -len(quote_currency)], quote_currency


def infer_quote_currency_from_pip_value(pip_value: str) -> str | None:
    """Extract the settlement currency from the pip-value text."""

    match = re.search(r"\b([A-Z]{3})\b", pip_value)
    return match.group(1) if match else None


def build_internal_id(asset_class: str, canonical_symbol: str) -> str:
    """Build a stable internal identifier."""

    raw = f"{asset_class}-{canonical_symbol}".lower()
    raw = raw.replace("/", "-").replace(".", "-").replace(" ", "-")
    return re.sub(r"[^a-z0-9-]+", "-", raw).strip("-")
