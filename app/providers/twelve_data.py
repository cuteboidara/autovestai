"""Twelve Data adapter."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

from .base import ProviderAdapter


@dataclass(slots=True)
class TwelveDataProvider(ProviderAdapter):
    """Free-tier Twelve Data adapter."""

    @property
    def name(self) -> str:
        return "twelve_data"

    def search_instrument(self, query: str) -> list[dict[str, str]]:
        params = urlencode({"symbol": query, "apikey": self.settings.twelve_data_api_key or "demo"})
        url = f"https://api.twelvedata.com/symbol_search?{params}"
        response = self.http_client.get_json(url, cache_namespace=self.name)
        return response.get("data", [])

    def get_quote(self, symbol: str) -> dict[str, object]:
        params = urlencode({"symbol": symbol, "apikey": self.settings.twelve_data_api_key or "demo"})
        url = f"https://api.twelvedata.com/quote?{params}"
        return self.http_client.get_json(url, cache_namespace=self.name)

    def get_ohlcv(
        self,
        symbol: str,
        interval: str,
        start: str | None,
        end: str | None,
    ) -> dict[str, object]:
        request = {
            "symbol": symbol,
            "interval": interval,
            "apikey": self.settings.twelve_data_api_key or "demo",
            "outputsize": 5000,
        }
        if start:
            request["start_date"] = start
        if end:
            request["end_date"] = end
        params = urlencode(request)
        url = f"https://api.twelvedata.com/time_series?{params}"
        return self.http_client.get_json(url, cache_namespace=self.name)

    def get_metadata(self, symbol: str) -> dict[str, object]:
        params = urlencode({"symbol": symbol, "apikey": self.settings.twelve_data_api_key or "demo"})
        url = f"https://api.twelvedata.com/instrument?{params}"
        return self.http_client.get_json(url, cache_namespace=self.name)

    def healthcheck(self) -> dict[str, object]:
        try:
            self.get_quote("AAPL")
            return {"provider": self.name, "healthy": True}
        except Exception as error:  # pragma: no cover - network dependent
            return {"provider": self.name, "healthy": False, "error": str(error)}
