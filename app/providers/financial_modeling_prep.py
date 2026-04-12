"""Financial Modeling Prep adapter."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

from .base import ProviderAdapter


@dataclass(slots=True)
class FinancialModelingPrepProvider(ProviderAdapter):
    """Adapter for FMP free/public endpoints."""

    @property
    def name(self) -> str:
        return "financial_modeling_prep"

    def search_instrument(self, query: str) -> list[dict[str, str]]:
        params = urlencode(
            {
                "query": query,
                "limit": 10,
                "apikey": self.settings.financial_modeling_prep_api_key or "",
            }
        )
        url = f"https://financialmodelingprep.com/stable/search-symbol?{params}"
        return self.http_client.get_json(url, cache_namespace=self.name)

    def get_quote(self, symbol: str) -> dict[str, object]:
        params = urlencode({"apikey": self.settings.financial_modeling_prep_api_key or ""})
        url = f"https://financialmodelingprep.com/stable/quote-short/{symbol}?{params}"
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
                "from": start or "",
                "to": end or "",
                "apikey": self.settings.financial_modeling_prep_api_key or "",
            }
        )
        url = (
            "https://financialmodelingprep.com/stable/historical-price-eod/full/"
            f"{symbol}?{params}"
        )
        response = self.http_client.get_json(url, cache_namespace=self.name)
        response["_requested_interval"] = interval
        return response

    def get_metadata(self, symbol: str) -> dict[str, object]:
        params = urlencode({"apikey": self.settings.financial_modeling_prep_api_key or ""})
        url = f"https://financialmodelingprep.com/stable/profile/{symbol}?{params}"
        return self.http_client.get_json(url, cache_namespace=self.name)

    def healthcheck(self) -> dict[str, object]:
        try:
            self.get_quote("MSFT")
            return {"provider": self.name, "healthy": True}
        except Exception as error:  # pragma: no cover - network dependent
            return {"provider": self.name, "healthy": False, "error": str(error)}

