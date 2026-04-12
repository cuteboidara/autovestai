"""Provider interface for public market-data adapters."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from app.config import ActivationSettings
from app.services.http_client import CachedHttpClient


@dataclass(slots=True)
class ProviderAdapter(ABC):
    """Abstract provider adapter used by the activation layer."""

    settings: ActivationSettings
    http_client: CachedHttpClient

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the normalized provider name."""

    def is_enabled(self) -> bool:
        """Return whether this provider is enabled by configuration."""

        return self.settings.is_provider_enabled(self.name)

    @abstractmethod
    def search_instrument(self, query: str) -> list[dict[str, Any]]:
        """Search for symbols or instruments matching a query."""

    @abstractmethod
    def get_quote(self, symbol: str) -> dict[str, Any]:
        """Fetch the latest quote snapshot for a symbol."""

    @abstractmethod
    def get_ohlcv(
        self,
        symbol: str,
        interval: str,
        start: str | None,
        end: str | None,
    ) -> dict[str, Any]:
        """Fetch historical OHLCV data."""

    @abstractmethod
    def get_metadata(self, symbol: str) -> dict[str, Any]:
        """Fetch instrument metadata."""

    @abstractmethod
    def healthcheck(self) -> dict[str, Any]:
        """Return provider health information."""

