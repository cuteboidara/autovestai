"""Provider registry for the asset activation pipeline."""

from __future__ import annotations

from app.config import ActivationSettings
from app.services.http_client import CachedHttpClient

from .alpha_vantage import AlphaVantageProvider
from .base import ProviderAdapter
from .binance import BinanceProvider
from .coingecko import CoinGeckoProvider
from .exchange_rate_host import ExchangeRateHostProvider
from .financial_modeling_prep import FinancialModelingPrepProvider
from .fred import FredProvider
from .stooq import StooqProvider
from .twelve_data import TwelveDataProvider
from .yahoo_finance import YahooFinanceProvider


def build_provider_registry(settings: ActivationSettings) -> list[ProviderAdapter]:
    """Instantiate the configured provider adapters."""

    http_client = CachedHttpClient(settings)
    providers: list[ProviderAdapter] = [
        YahooFinanceProvider(settings, http_client),
        StooqProvider(settings, http_client),
        AlphaVantageProvider(settings, http_client),
        TwelveDataProvider(settings, http_client),
        FinancialModelingPrepProvider(settings, http_client),
        CoinGeckoProvider(settings, http_client),
        BinanceProvider(settings, http_client),
        ExchangeRateHostProvider(settings, http_client),
        FredProvider(settings, http_client),
    ]
    return [provider for provider in providers if provider.is_enabled()]

