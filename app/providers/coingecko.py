"""CoinGecko adapter."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

from .base import ProviderAdapter


@dataclass(slots=True)
class CoinGeckoProvider(ProviderAdapter):
    """Public crypto-market adapter."""

    @property
    def name(self) -> str:
        return "coingecko"

    def search_instrument(self, query: str) -> list[dict[str, str]]:
        params = urlencode({"query": query})
        url = f"https://api.coingecko.com/api/v3/search?{params}"
        response = self.http_client.get_json(url, cache_namespace=self.name)
        return response.get("coins", [])

    def get_quote(self, symbol: str) -> dict[str, object]:
        params = urlencode({"ids": symbol, "vs_currencies": "usd"})
        url = f"https://api.coingecko.com/api/v3/simple/price?{params}"
        return self.http_client.get_json(url, cache_namespace=self.name)

    def get_ohlcv(
        self,
        symbol: str,
        interval: str,
        start: str | None,
        end: str | None,
    ) -> dict[str, object]:
        days = "365" if start or end else "30"
        params = urlencode({"vs_currency": "usd", "days": days, "interval": interval})
        url = f"https://api.coingecko.com/api/v3/coins/{symbol}/market_chart?{params}"
        response = self.http_client.get_json(url, cache_namespace=self.name)
        response["_requested_window"] = {"start": start, "end": end}
        return response

    def get_metadata(self, symbol: str) -> dict[str, object]:
        url = f"https://api.coingecko.com/api/v3/coins/{symbol}"
        return self.http_client.get_json(url, cache_namespace=self.name)

    def healthcheck(self) -> dict[str, object]:
        try:
            self.get_quote("bitcoin")
            return {"provider": self.name, "healthy": True}
        except Exception as error:  # pragma: no cover - network dependent
            return {"provider": self.name, "healthy": False, "error": str(error)}

