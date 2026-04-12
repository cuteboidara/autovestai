import unittest
from pathlib import Path

from app.parsing.contract_specifications_parser import ContractSpecificationsParser


ROOT = Path(__file__).resolve().parents[2]


class ContractSpecificationsParserTest(unittest.TestCase):
    def test_parser_extracts_full_pdf_universe(self) -> None:
        text = (ROOT / "Contract-Specifications.txt").read_text(encoding="utf-8")
        parser = ContractSpecificationsParser()

        assets = parser.parse_text(text)

        self.assertEqual(len(assets), 337)
        counts_by_section = {}
        for asset in assets:
            counts_by_section[asset.pdf_section] = counts_by_section.get(asset.pdf_section, 0) + 1

        self.assertEqual(counts_by_section["FOREX"], 40)
        self.assertEqual(counts_by_section["METALS"], 5)
        self.assertEqual(counts_by_section["INDICES"], 14)
        self.assertEqual(counts_by_section["COMMODITIES"], 11)
        self.assertEqual(counts_by_section["CRYPTO"], 18)
        self.assertEqual(counts_by_section["STOCKS US"], 111)
        self.assertEqual(counts_by_section["ETFS"], 19)
        self.assertEqual(counts_by_section["STOCKS EU"], 30)
        self.assertEqual(counts_by_section["STOCKS UK"], 13)
        self.assertEqual(counts_by_section["STOCKS MIDEAST"], 52)
        self.assertEqual(counts_by_section["STOCKS LATAM"], 19)
        self.assertEqual(counts_by_section["STOCKS ROW"], 5)


if __name__ == "__main__":
    unittest.main()

