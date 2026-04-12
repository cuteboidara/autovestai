import unittest
from pathlib import Path

from app.mapping.resolver import ActivationResolver
from app.parsing.contract_specifications_parser import ContractSpecificationsParser


ROOT = Path(__file__).resolve().parents[2]


class ActivationResolverTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        text = (ROOT / "Contract-Specifications.txt").read_text(encoding="utf-8")
        parser = ContractSpecificationsParser()
        cls.assets = parser.parse_text(text)
        cls.asset_by_symbol = {asset.raw_pdf_symbol: asset for asset in cls.assets}
        cls.resolver = ActivationResolver()

    def test_forex_pair_maps_to_forex_api(self) -> None:
        entry = self.resolver.resolve_asset(self.asset_by_symbol["EURUSD"])
        self.assertEqual(entry.canonical_symbol, "EUR/USD")
        self.assertEqual(entry.status, "active")
        self.assertEqual(entry.backend_seed["quote_source"], "FOREX_API")

    def test_us_alias_maps_to_canonical_ticker(self) -> None:
        entry = self.resolver.resolve_asset(self.asset_by_symbol["APPLE"])
        self.assertEqual(entry.canonical_symbol, "AAPL")
        self.assertEqual(entry.provider_symbol_map["yahoo_finance"]["symbol"], "AAPL")
        self.assertEqual(entry.status, "active")

    def test_index_proxy_is_marked_partial(self) -> None:
        entry = self.resolver.resolve_asset(self.asset_by_symbol["NSDQ-cash"])
        self.assertEqual(entry.canonical_symbol, "NDX")
        self.assertEqual(entry.status, "partial")
        self.assertEqual(entry.backend_seed["quote_symbol"], "^NDX")

    def test_mideast_alias_is_preserved_with_manual_review_status(self) -> None:
        entry = self.resolver.resolve_asset(self.asset_by_symbol["ETISALAT"])
        self.assertEqual(entry.canonical_symbol, "EAND.AD")
        self.assertEqual(entry.status, "partial")
        self.assertEqual(entry.backend_seed["quote_symbol"], "EAND.AD")


if __name__ == "__main__":
    unittest.main()
