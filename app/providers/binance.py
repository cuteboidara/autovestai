"""Binance public-market adapter."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

from .base import ProviderAdapter


@dataclass(slots=True)
class BinanceProvider(ProviderAdapter):
    """Public Binance spot adapter."""

    @property
    def name(self) -> str:
        return "binance"

    def search_instrument(self, query: str) -> list[dict[str, object]]:
        exchange_info = self.http_client.get_json(
            "https://api.binance.com/api/v3/exchangeInfo",
            cache_namespace=self.name,
        )
        query_upper = query.strip().upper()
        return [
            symbol
            for symbol in exchange_info.get("symbols", [])
            if query_upper in symbol.get("symbol", "")
        ]

    def get_quote(self, symbol: str) -> dict[str, object]:
        params = urlencode({"symbol": symbol})
        url = f"https://api.binance.com/api/v3/ticker/price?{params}"
        return self.http_client.get_json(url, cache_namespace=self.name)

    def get_ohlcv(
        self,
        symbol: str,
        interval: str,
        start: str | None,
        end: str | None,
    ) -> dict[str, object]:
        request = {"symbol": symbol, "interval": interval, "limit": 1000}
        if start:
            request["startTime"] = start
        if end:
            request["endTime"] = end
        params = urlencode(request)
        url = f"https://api.binance.com/api/v3/klines?{params}"
        return {"symbol": symbol, "data": self.http_client.get_json(url, cache_namespace=self.name)}

    def get_metadata(self, symbol: str) -> dict[str, object]:
        params = urlencode({"symbol": symbol})
        url = f"https://api.binance.com/api/v3/exchangeInfo?{params}"
        return self.http_client.get_json(url, cache_namespace=self.name)

    def healthcheck(self) -> dict[str, object]:
        try:
            self.get_quote("BTCUSDT")
            return {"provider": self.name, "healthy": True}
        except Exception as error:  # pragma: no cover - network dependent
            return {"provider": self.name, "healthy": False, "error": str(error)}

