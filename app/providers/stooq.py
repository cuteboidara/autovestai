"""Stooq adapter."""

from __future__ import annotations

from dataclasses import dataclass

from .base import ProviderAdapter


@dataclass(slots=True)
class StooqProvider(ProviderAdapter):
    """Free Stooq adapter used mainly for indices and futures proxies."""

    @property
    def name(self) -> str:
        return "stooq"

    def search_instrument(self, query: str) -> list[dict[str, str]]:
        return [{"query": query, "notes": "Stooq has no stable public search endpoint."}]

    def get_quote(self, symbol: str) -> dict[str, str]:
        url = f"https://stooq.com/q/l/?s={symbol}&f=sd2t2ohlcv&h&e=csv"
        payload = self.http_client.get_text(url, cache_namespace=self.name)
        return {"symbol": symbol, "payload": payload}

    def get_ohlcv(
        self,
        symbol: str,
        interval: str,
        start: str | None,
        end: str | None,
    ) -> dict[str, str | None]:
        return {
            "symbol": symbol,
            "interval": interval,
            "start": start,
            "end": end,
            "notes": "Use the Stooq CSV download endpoint with provider-specific intervals.",
        }

    def get_metadata(self, symbol: str) -> dict[str, str]:
        return {
            "symbol": symbol,
            "notes": "Stooq exposes quote payloads, but metadata is limited.",
        }

    def healthcheck(self) -> dict[str, str | bool]:
        try:
            self.get_quote("^spx")
            return {"provider": self.name, "healthy": True}
        except Exception as error:  # pragma: no cover - network dependent
            return {"provider": self.name, "healthy": False, "error": str(error)}

