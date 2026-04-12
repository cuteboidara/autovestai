"""ExchangeRate.host adapter."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

from .base import ProviderAdapter


@dataclass(slots=True)
class ExchangeRateHostProvider(ProviderAdapter):
    """Free forex/rates adapter."""

    @property
    def name(self) -> str:
        return "exchange_rate_host"

    def search_instrument(self, query: str) -> list[dict[str, str]]:
        response = self.http_client.get_json(
            "https://api.exchangerate.host/list",
            cache_namespace=self.name,
        )
        currencies = response.get("currencies", {})
        query_upper = query.strip().upper()
        return [
            {"code": code, "name": name}
            for code, name in currencies.items()
            if query_upper in code or query_upper in str(name).upper()
        ][:20]

    def get_quote(self, symbol: str) -> dict[str, object]:
        base, quote = symbol.split("/")
        params = urlencode({"base": base, "symbols": quote})
        url = f"https://api.exchangerate.host/live?{params}"
        response = self.http_client.get_json(url, cache_namespace=self.name)
        response["_pair"] = symbol
        return response

    def get_ohlcv(
        self,
        symbol: str,
        interval: str,
        start: str | None,
        end: str | None,
    ) -> dict[str, object]:
        base, quote = symbol.split("/")
        params = urlencode(
            {
                "base": base,
                "symbols": quote,
                "start_date": start or "",
                "end_date": end or "",
            }
        )
        url = f"https://api.exchangerate.host/timeframe?{params}"
        response = self.http_client.get_json(url, cache_namespace=self.name)
        response["_interval"] = interval
        return response

    def get_metadata(self, symbol: str) -> dict[str, str]:
        base, quote = symbol.split("/")
        return {
            "symbol": symbol,
            "base_currency": base,
            "quote_currency": quote,
        }

    def healthcheck(self) -> dict[str, object]:
        try:
            self.get_quote("EUR/USD")
            return {"provider": self.name, "healthy": True}
        except Exception as error:  # pragma: no cover - network dependent
            return {"provider": self.name, "healthy": False, "error": str(error)}

