"""FRED adapter."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

from .base import ProviderAdapter


@dataclass(slots=True)
class FredProvider(ProviderAdapter):
    """FRED adapter for macro/rates proxies."""

    @property
    def name(self) -> str:
        return "fred"

    def search_instrument(self, query: str) -> list[dict[str, object]]:
        params = urlencode(
            {
                "search_text": query,
                "api_key": self.settings.fred_api_key or "",
                "file_type": "json",
            }
        )
        url = f"https://api.stlouisfed.org/fred/series/search?{params}"
        response = self.http_client.get_json(url, cache_namespace=self.name)
        return response.get("seriess", [])

    def get_quote(self, symbol: str) -> dict[str, object]:
        params = urlencode(
            {
                "series_id": symbol,
                "api_key": self.settings.fred_api_key or "",
                "file_type": "json",
                "limit": 1,
                "sort_order": "desc",
            }
        )
        url = f"https://api.stlouisfed.org/fred/series/observations?{params}"
        return self.http_client.get_json(url, cache_namespace=self.name)

    def get_ohlcv(
        self,
        symbol: str,
        interval: str,
        start: str | None,
        end: str | None,
    ) -> dict[str, object]:
        params = urlencode(
            {
                "series_id": symbol,
                "api_key": self.settings.fred_api_key or "",
                "file_type": "json",
                "observation_start": start or "",
                "observation_end": end or "",
            }
        )
        url = f"https://api.stlouisfed.org/fred/series/observations?{params}"
        response = self.http_client.get_json(url, cache_namespace=self.name)
        response["_interval"] = interval
        return response

    def get_metadata(self, symbol: str) -> dict[str, object]:
        params = urlencode(
            {
                "series_id": symbol,
                "api_key": self.settings.fred_api_key or "",
                "file_type": "json",
            }
        )
        url = f"https://api.stlouisfed.org/fred/series?{params}"
        return self.http_client.get_json(url, cache_namespace=self.name)

    def healthcheck(self) -> dict[str, object]:
        try:
            self.get_quote("DEXUSEU")
            return {"provider": self.name, "healthy": True}
        except Exception as error:  # pragma: no cover - network dependent
            return {"provider": self.name, "healthy": False, "error": str(error)}

