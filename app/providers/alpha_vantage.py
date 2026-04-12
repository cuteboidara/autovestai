"""Alpha Vantage adapter."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

from .base import ProviderAdapter


@dataclass(slots=True)
class AlphaVantageProvider(ProviderAdapter):
    """Free-tier Alpha Vantage adapter."""

    @property
    def name(self) -> str:
        return "alpha_vantage"

    def search_instrument(self, query: str) -> list[dict[str, str]]:
        params = urlencode(
            {
                "function": "SYMBOL_SEARCH",
                "keywords": query,
                "apikey": self.settings.alpha_vantage_api_key or "demo",
            }
        )
        url = f"https://www.alphavantage.co/query?{params}"
        response = self.http_client.get_json(url, cache_namespace=self.name)
        return response.get("bestMatches", [])

    def get_quote(self, symbol: str) -> dict[str, object]:
        params = urlencode(
            {
                "function": "GLOBAL_QUOTE",
                "symbol": symbol,
                "apikey": self.settings.alpha_vantage_api_key or "demo",
            }
        )
        url = f"https://www.alphavantage.co/query?{params}"
        return self.http_client.get_json(url, cache_namespace=self.name)

    def get_ohlcv(
        self,
        symbol: str,
        interval: str,
        start: str | None,
        end: str | None,
    ) -> dict[str, object]:
        function = "TIME_SERIES_INTRADAY" if interval.endswith("min") else "TIME_SERIES_DAILY"
        params = urlencode(
            {
                "function": function,
                "symbol": symbol,
                "interval": interval,
                "apikey": self.settings.alpha_vantage_api_key or "demo",
                "outputsize": "full",
            }
        )
        url = f"https://www.alphavantage.co/query?{params}"
        response = self.http_client.get_json(url, cache_namespace=self.name)
        if start or end:
            response["_requested_window"] = {"start": start, "end": end}
        return response

    def get_metadata(self, symbol: str) -> dict[str, object]:
        params = urlencode(
            {
                "function": "OVERVIEW",
                "symbol": symbol,
                "apikey": self.settings.alpha_vantage_api_key or "demo",
            }
        )
        url = f"https://www.alphavantage.co/query?{params}"
        return self.http_client.get_json(url, cache_namespace=self.name)

    def healthcheck(self) -> dict[str, object]:
        try:
            self.get_quote("MSFT")
            return {"provider": self.name, "healthy": True}
        except Exception as error:  # pragma: no cover - network dependent
            return {"provider": self.name, "healthy": False, "error": str(error)}

