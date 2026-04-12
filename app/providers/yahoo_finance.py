"""Yahoo Finance adapter."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

from .base import ProviderAdapter


@dataclass(slots=True)
class YahooFinanceProvider(ProviderAdapter):
    """Public Yahoo Finance adapter for quotes, charts, and search."""

    @property
    def name(self) -> str:
        return "yahoo_finance"

    def search_instrument(self, query: str) -> list[dict[str, str]]:
        params = urlencode({"q": query, "quotesCount": 10, "newsCount": 0})
        url = f"https://query1.finance.yahoo.com/v1/finance/search?{params}"
        response = self.http_client.get_json(url, cache_namespace=self.name)
        return response.get("quotes", [])

    def get_quote(self, symbol: str) -> dict[str, object]:
        url = (
            "https://query1.finance.yahoo.com/v8/finance/chart/"
            f"{symbol}?interval=1d&range=1d"
        )
        return self.http_client.get_json(url, cache_namespace=self.name)

    def get_ohlcv(
        self,
        symbol: str,
        interval: str,
        start: str | None,
        end: str | None,
    ) -> dict[str, object]:
        params = {"interval": interval, "range": "1mo"}
        if start:
            params["period1"] = start
        if end:
            params["period2"] = end
        url = (
            "https://query1.finance.yahoo.com/v8/finance/chart/"
            f"{symbol}?{urlencode(params)}"
        )
        return self.http_client.get_json(url, cache_namespace=self.name)

    def get_metadata(self, symbol: str) -> dict[str, object]:
        url = (
            "https://query1.finance.yahoo.com/v10/finance/quoteSummary/"
            f"{symbol}?modules=price,summaryProfile"
        )
        return self.http_client.get_json(url, cache_namespace=self.name)

    def healthcheck(self) -> dict[str, object]:
        try:
            self.get_quote("SPY")
            return {"provider": self.name, "healthy": True}
        except Exception as error:  # pragma: no cover - network dependent
            return {"provider": self.name, "healthy": False, "error": str(error)}

