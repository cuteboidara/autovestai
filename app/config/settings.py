"""Runtime settings for the asset activation pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


DEFAULT_PROVIDERS = (
    "yahoo_finance",
    "stooq",
    "alpha_vantage",
    "twelve_data",
    "financial_modeling_prep",
    "coingecko",
    "binance",
    "exchange_rate_host",
    "fred",
)


@dataclass(slots=True)
class ActivationSettings:
    """Holds filesystem, provider, and HTTP configuration."""

    project_root: Path
    output_dir: Path
    cache_dir: Path
    node_executable: str
    pdf_extractor_script: Path
    request_timeout_seconds: float
    retry_attempts: int
    retry_backoff_seconds: float
    user_agent: str
    enabled_providers: tuple[str, ...]
    alpha_vantage_api_key: str | None
    twelve_data_api_key: str | None
    financial_modeling_prep_api_key: str | None
    fred_api_key: str | None

    @classmethod
    def from_env(
        cls,
        *,
        project_root: Path | None = None,
        output_dir: Path | None = None,
    ) -> "ActivationSettings":
        root = (project_root or Path.cwd()).resolve()
        resolved_output_dir = (
            output_dir
            or cls._path_from_env("ASSET_ACTIVATION_OUTPUT_DIR", root)
            or root / "activation_output"
        )
        cache_dir = cls._path_from_env("ASSET_ACTIVATION_CACHE_DIR", root) or (
            root / ".cache" / "asset_activation"
        )
        node_executable = os.getenv("ASSET_ACTIVATION_NODE_EXECUTABLE", "node").strip() or "node"
        enabled_providers = cls._providers_from_env()
        return cls(
            project_root=root,
            output_dir=resolved_output_dir,
            cache_dir=cache_dir,
            node_executable=node_executable,
            pdf_extractor_script=root / "app" / "scripts" / "extract_pdf_text.js",
            request_timeout_seconds=float(
                os.getenv("ASSET_ACTIVATION_REQUEST_TIMEOUT_SECONDS", "12")
            ),
            retry_attempts=int(os.getenv("ASSET_ACTIVATION_RETRY_ATTEMPTS", "3")),
            retry_backoff_seconds=float(
                os.getenv("ASSET_ACTIVATION_RETRY_BACKOFF_SECONDS", "1.5")
            ),
            user_agent=os.getenv(
                "ASSET_ACTIVATION_USER_AGENT",
                "AutovestAIAssetActivation/1.0 (+https://autovestai.com)",
            ),
            enabled_providers=enabled_providers,
            alpha_vantage_api_key=cls._optional_env("ALPHA_VANTAGE_API_KEY"),
            twelve_data_api_key=cls._optional_env("TWELVE_DATA_API_KEY"),
            financial_modeling_prep_api_key=cls._optional_env("FMP_API_KEY"),
            fred_api_key=cls._optional_env("FRED_API_KEY"),
        )

    def is_provider_enabled(self, provider_name: str) -> bool:
        """Return whether a provider is enabled for runtime use."""

        return provider_name in self.enabled_providers

    @staticmethod
    def _optional_env(key: str) -> str | None:
        value = os.getenv(key, "").strip()
        return value or None

    @staticmethod
    def _providers_from_env() -> tuple[str, ...]:
        raw = os.getenv("ASSET_ACTIVATION_ENABLED_PROVIDERS", "").strip()
        if not raw:
            return DEFAULT_PROVIDERS
        values = tuple(
            provider.strip().lower()
            for provider in raw.split(",")
            if provider.strip()
        )
        return values or DEFAULT_PROVIDERS

    @staticmethod
    def _path_from_env(key: str, project_root: Path) -> Path | None:
        raw = os.getenv(key, "").strip()
        if not raw:
            return None
        path = Path(raw)
        return path if path.is_absolute() else project_root / path

