"""Manual alias catalog and proxy definitions for the PDF instrument universe."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class AliasRecord:
    """Provider-symbol aliases and metadata for a canonical instrument."""

    canonical_symbol: str
    display_symbol: str | None = None
    yahoo_symbol: str | None = None
    twelve_data_symbol: str | None = None
    alpha_vantage_symbol: str | None = None
    fmp_symbol: str | None = None
    stooq_symbol: str | None = None
    binance_symbol: str | None = None
    coingecko_id: str | None = None
    exchange: str | None = None
    country: str | None = None
    region: str | None = None
    confidence: str = "high_confidence_alias"
    notes: tuple[str, ...] = field(default_factory=tuple)


US_STOCK_ALIASES: dict[str, AliasRecord] = {
    "ABBOT": AliasRecord("ABT", "ABT", "ABT", "ABT", "ABT", "ABT", "abt.us"),
    "ALCOA": AliasRecord("AA", "AA", "AA", "AA", "AA", "AA", "aa.us"),
    "ALIBABA": AliasRecord("BABA", "BABA", "BABA", "BABA", "BABA", "BABA", "baba.us"),
    "AMAZON": AliasRecord("AMZN", "AMZN", "AMZN", "AMZN", "AMZN", "AMZN", "amzn.us"),
    "AMEX": AliasRecord("AXP", "AXP", "AXP", "AXP", "AXP", "AXP", "axp.us"),
    "APPLE": AliasRecord("AAPL", "AAPL", "AAPL", "AAPL", "AAPL", "AAPL", "aapl.us"),
    "ASMLUS": AliasRecord("ASML", "ASML", "ASML", "ASML", "ASML", "ASML", "asml.us"),
    "ATNT": AliasRecord("T", "T", "T", "T", "T", "T", "t.us"),
    "BAIDU": AliasRecord("BIDU", "BIDU", "BIDU", "BIDU", "BIDU", "BIDU", "bidu.us"),
    "BBRY": AliasRecord("BB", "BB", "BB", "BB", "BB", "BB", "bb.us"),
    "BOA": AliasRecord("BAC", "BAC", "BAC", "BAC", "BAC", "BAC", "bac.us"),
    "BOEING": AliasRecord("BA", "BA", "BA", "BA", "BA", "BA", "ba.us"),
    "BROADCOM": AliasRecord("AVGO", "AVGO", "AVGO", "AVGO", "AVGO", "AVGO", "avgo.us"),
    "CHEVRON": AliasRecord("CVX", "CVX", "CVX", "CVX", "CVX", "CVX", "cvx.us"),
    "CITIGROUP": AliasRecord("C", "C", "C", "C", "C", "C", "c.us"),
    "COCACOLA": AliasRecord("KO", "KO", "KO", "KO", "KO", "KO", "ko.us"),
    "DELTA": AliasRecord("DAL", "DAL", "DAL", "DAL", "DAL", "DAL", "dal.us"),
    "DIGINEX": AliasRecord(
        "DGNX",
        "DGNX",
        "DGNX",
        "DGNX",
        confidence="heuristic_match",
        notes=("Current public ticker requires manual confirmation.",),
    ),
    "DISNEY": AliasRecord("DIS", "DIS", "DIS", "DIS", "DIS", "DIS", "dis.us"),
    "EXXONMOBIL": AliasRecord("XOM", "XOM", "XOM", "XOM", "XOM", "XOM", "xom.us"),
    "FACEBOOK": AliasRecord("META", "META", "META", "META", "META", "META", "meta.us"),
    "FORD": AliasRecord("F", "F", "F", "F", "F", "F", "f.us"),
    "FSOLAR": AliasRecord("FSLR", "FSLR", "FSLR", "FSLR", "FSLR", "FSLR", "fslr.us"),
    "GOLDMNSACHS": AliasRecord("GS", "GS", "GS", "GS", "GS", "GS", "gs.us"),
    "GOOGLE": AliasRecord(
        "GOOGL",
        "GOOGL",
        "GOOGL",
        "GOOGL",
        "GOOGL",
        "GOOGL",
        "googl.us",
        notes=("Mapped to Alphabet Class A (GOOGL) for higher public-data coverage.",),
    ),
    "HILTON": AliasRecord("HLT", "HLT", "HLT", "HLT", "HLT", "HLT", "hlt.us"),
    "INTEL": AliasRecord("INTC", "INTC", "INTC", "INTC", "INTC", "INTC", "intc.us"),
    "JPMORGAN": AliasRecord("JPM", "JPM", "JPM", "JPM", "JPM", "JPM", "jpm.us"),
    "MASTERCARD": AliasRecord("MA", "MA", "MA", "MA", "MA", "MA", "ma.us"),
    "MCDONALDS": AliasRecord("MCD", "MCD", "MCD", "MCD", "MCD", "MCD", "mcd.us"),
    "MICROSOFT": AliasRecord("MSFT", "MSFT", "MSFT", "MSFT", "MSFT", "MSFT", "msft.us"),
    "MORGANSTAN": AliasRecord("MS", "MS", "MS", "MS", "MS", "MS", "ms.us"),
    "MOTOROLA": AliasRecord("MSI", "MSI", "MSI", "MSI", "MSI", "MSI", "msi.us"),
    "NETFLIX": AliasRecord("NFLX", "NFLX", "NFLX", "NFLX", "NFLX", "NFLX", "nflx.us"),
    "NIKE": AliasRecord("NKE", "NKE", "NKE", "NKE", "NKE", "NKE", "nke.us"),
    "NVIDIA": AliasRecord("NVDA", "NVDA", "NVDA", "NVDA", "NVDA", "NVDA", "nvda.us"),
    "ORACLE": AliasRecord("ORCL", "ORCL", "ORCL", "ORCL", "ORCL", "ORCL", "orcl.us"),
    "PAYPAL": AliasRecord("PYPL", "PYPL", "PYPL", "PYPL", "PYPL", "PYPL", "pypl.us"),
    "PEPSICO": AliasRecord("PEP", "PEP", "PEP", "PEP", "PEP", "PEP", "pep.us"),
    "PETRO": AliasRecord("PBR", "PBR", "PBR", "PBR", "PBR", "PBR", "pbr.us"),
    "PFIZER": AliasRecord("PFE", "PFE", "PFE", "PFE", "PFE", "PFE", "pfe.us"),
    "QUALCOMM": AliasRecord("QCOM", "QCOM", "QCOM", "QCOM", "QCOM", "QCOM", "qcom.us"),
    "REDDIT": AliasRecord("RDDT", "RDDT", "RDDT", "RDDT", "RDDT", "RDDT", "rddt.us"),
    "SHOPIFY": AliasRecord("SHOP", "SHOP", "SHOP", "SHOP", "SHOP", "SHOP", "shop.us"),
    "SNAPCHAT": AliasRecord("SNAP", "SNAP", "SNAP", "SNAP", "SNAP", "SNAP", "snap.us"),
    "STARBUCKS": AliasRecord("SBUX", "SBUX", "SBUX", "SBUX", "SBUX", "SBUX", "sbux.us"),
    "TOYOTA": AliasRecord("TM", "TM", "TM", "TM", "TM", "TM", "tm.us"),
    "VERIZON": AliasRecord("VZ", "VZ", "VZ", "VZ", "VZ", "VZ", "vz.us"),
    "VISA": AliasRecord("V", "V", "V", "V", "V", "V", "v.us"),
    "WALMART": AliasRecord("WMT", "WMT", "WMT", "WMT", "WMT", "WMT", "wmt.us"),
    "WELLSFARGO": AliasRecord("WFC", "WFC", "WFC", "WFC", "WFC", "WFC", "wfc.us"),
    "ZOOM": AliasRecord("ZM", "ZM", "ZM", "ZM", "ZM", "ZM", "zm.us"),
}


EU_STOCK_ALIASES: dict[str, AliasRecord] = {
    "ABBN": AliasRecord("ABBN.SW", yahoo_symbol="ABBN.SW", twelve_data_symbol="ABBN.SW", exchange="SIX", country="Switzerland", region="EU", confidence="exact_match"),
    "HOLN": AliasRecord("HOLN.SW", yahoo_symbol="HOLN.SW", twelve_data_symbol="HOLN.SW", exchange="SIX", country="Switzerland", region="EU", confidence="exact_match"),
    "LONN": AliasRecord("LONN.SW", yahoo_symbol="LONN.SW", twelve_data_symbol="LONN.SW", exchange="SIX", country="Switzerland", region="EU", confidence="exact_match"),
    "NESTLE": AliasRecord("NESN.SW", display_symbol="NESN.SW", yahoo_symbol="NESN.SW", twelve_data_symbol="NESN.SW", exchange="SIX", country="Switzerland", region="EU"),
    "ROCHE": AliasRecord("ROG.SW", display_symbol="ROG.SW", yahoo_symbol="ROG.SW", twelve_data_symbol="ROG.SW", exchange="SIX", country="Switzerland", region="EU"),
    "SCMN": AliasRecord("SCMN.SW", yahoo_symbol="SCMN.SW", twelve_data_symbol="SCMN.SW", exchange="SIX", country="Switzerland", region="EU", confidence="exact_match"),
    "SWATCH": AliasRecord("UHR.SW", display_symbol="UHR.SW", yahoo_symbol="UHR.SW", twelve_data_symbol="UHR.SW", exchange="SIX", country="Switzerland", region="EU"),
    "SWISSQUOTE": AliasRecord("SQN.SW", display_symbol="SQN.SW", yahoo_symbol="SQN.SW", twelve_data_symbol="SQN.SW", exchange="SIX", country="Switzerland", region="EU"),
    "ZURN": AliasRecord("ZURN.SW", yahoo_symbol="ZURN.SW", twelve_data_symbol="ZURN.SW", exchange="SIX", country="Switzerland", region="EU", confidence="exact_match"),
    "ADIDAS": AliasRecord("ADS.DE", yahoo_symbol="ADS.DE", twelve_data_symbol="ADS.DE", exchange="XETRA", country="Germany", region="EU"),
    "ALLI": AliasRecord("ALV.DE", yahoo_symbol="ALV.DE", twelve_data_symbol="ALV.DE", exchange="XETRA", country="Germany", region="EU"),
    "BMW": AliasRecord("BMW.DE", yahoo_symbol="BMW.DE", twelve_data_symbol="BMW.DE", exchange="XETRA", country="Germany", region="EU", confidence="exact_match"),
    "COMMERZBANK": AliasRecord("CBK.DE", yahoo_symbol="CBK.DE", twelve_data_symbol="CBK.DE", exchange="XETRA", country="Germany", region="EU"),
    "DBFRA": AliasRecord("DBK.DE", yahoo_symbol="DBK.DE", twelve_data_symbol="DBK.DE", exchange="XETRA", country="Germany", region="EU"),
    "PORSCHE": AliasRecord("PAH3.DE", yahoo_symbol="PAH3.DE", twelve_data_symbol="PAH3.DE", exchange="XETRA", country="Germany", region="EU"),
    "PORSCHE911": AliasRecord("P911.DE", yahoo_symbol="P911.DE", twelve_data_symbol="P911.DE", exchange="XETRA", country="Germany", region="EU"),
    "RHM": AliasRecord("RHM.DE", yahoo_symbol="RHM.DE", twelve_data_symbol="RHM.DE", exchange="XETRA", country="Germany", region="EU", confidence="exact_match"),
    "SIEMENS": AliasRecord("SIE.DE", yahoo_symbol="SIE.DE", twelve_data_symbol="SIE.DE", exchange="XETRA", country="Germany", region="EU"),
    "VOWGEN": AliasRecord("VOW3.DE", yahoo_symbol="VOW3.DE", twelve_data_symbol="VOW3.DE", exchange="XETRA", country="Germany", region="EU"),
    "BBVA": AliasRecord("BBVA.MC", yahoo_symbol="BBVA.MC", twelve_data_symbol="BBVA.MC", exchange="BME", country="Spain", region="EU"),
    "BSANMD": AliasRecord("SAN.MC", yahoo_symbol="SAN.MC", twelve_data_symbol="SAN.MC", exchange="BME", country="Spain", region="EU"),
    "INTEX": AliasRecord("ITX.MC", yahoo_symbol="ITX.MC", twelve_data_symbol="ITX.MC", exchange="BME", country="Spain", region="EU"),
    "REPSOL": AliasRecord("REP.MC", yahoo_symbol="REP.MC", twelve_data_symbol="REP.MC", exchange="BME", country="Spain", region="EU"),
    "TELEFONICA": AliasRecord("TEF.MC", yahoo_symbol="TEF.MC", twelve_data_symbol="TEF.MC", exchange="BME", country="Spain", region="EU"),
    "ENEL": AliasRecord("ENEL.MI", yahoo_symbol="ENEL.MI", twelve_data_symbol="ENEL.MI", exchange="Euronext Milan", country="Italy", region="EU", confidence="exact_match"),
    "ENI": AliasRecord("ENI.MI", yahoo_symbol="ENI.MI", twelve_data_symbol="ENI.MI", exchange="Euronext Milan", country="Italy", region="EU", confidence="exact_match"),
    "JUVE": AliasRecord("JUVE.MI", yahoo_symbol="JUVE.MI", twelve_data_symbol="JUVE.MI", exchange="Euronext Milan", country="Italy", region="EU", confidence="exact_match"),
    "POSTE-MIL": AliasRecord("PST.MI", yahoo_symbol="PST.MI", twelve_data_symbol="PST.MI", exchange="Euronext Milan", country="Italy", region="EU"),
    "UNISPA": AliasRecord("UCG.MI", yahoo_symbol="UCG.MI", twelve_data_symbol="UCG.MI", exchange="Euronext Milan", country="Italy", region="EU"),
    "PHAR": AliasRecord("PHARM.AS", yahoo_symbol="PHARM.AS", twelve_data_symbol="PHARM.AS", exchange="Euronext Amsterdam", country="Netherlands", region="EU"),
}


UK_STOCK_ALIASES: dict[str, AliasRecord] = {
    "ANTO": AliasRecord("ANTO.L", yahoo_symbol="ANTO.L", twelve_data_symbol="ANTO.L", exchange="LSE", country="United Kingdom", region="UK", confidence="exact_match"),
    "AVIVA": AliasRecord("AV.L", yahoo_symbol="AV.L", twelve_data_symbol="AV.L", exchange="LSE", country="United Kingdom", region="UK"),
    "BARC": AliasRecord("BARC.L", yahoo_symbol="BARC.L", twelve_data_symbol="BARC.L", exchange="LSE", country="United Kingdom", region="UK", confidence="exact_match"),
    "BAY": AliasRecord("IAG.L", yahoo_symbol="IAG.L", twelve_data_symbol="IAG.L", exchange="LSE", country="United Kingdom", region="UK"),
    "BP": AliasRecord("BP.L", yahoo_symbol="BP.L", twelve_data_symbol="BP.L", exchange="LSE", country="United Kingdom", region="UK", confidence="exact_match"),
    "BTGROUP": AliasRecord("BT-A.L", yahoo_symbol="BT-A.L", twelve_data_symbol="BT-A.L", exchange="LSE", country="United Kingdom", region="UK"),
    "CNA": AliasRecord("CNA.L", yahoo_symbol="CNA.L", twelve_data_symbol="CNA.L", exchange="LSE", country="United Kingdom", region="UK", confidence="exact_match"),
    "HSBC": AliasRecord("HSBA.L", yahoo_symbol="HSBA.L", twelve_data_symbol="HSBA.L", exchange="LSE", country="United Kingdom", region="UK"),
    "LGEN": AliasRecord("LGEN.L", yahoo_symbol="LGEN.L", twelve_data_symbol="LGEN.L", exchange="LSE", country="United Kingdom", region="UK", confidence="exact_match"),
    "LLOY": AliasRecord("LLOY.L", yahoo_symbol="LLOY.L", twelve_data_symbol="LLOY.L", exchange="LSE", country="United Kingdom", region="UK", confidence="exact_match"),
    "RR": AliasRecord("RR.L", yahoo_symbol="RR.L", twelve_data_symbol="RR.L", exchange="LSE", country="United Kingdom", region="UK", confidence="exact_match"),
    "TESCO": AliasRecord("TSCO.L", yahoo_symbol="TSCO.L", twelve_data_symbol="TSCO.L", exchange="LSE", country="United Kingdom", region="UK"),
    "VOD": AliasRecord("VOD.L", yahoo_symbol="VOD.L", twelve_data_symbol="VOD.L", exchange="LSE", country="United Kingdom", region="UK", confidence="exact_match"),
}


LATAM_STOCK_ALIASES: dict[str, AliasRecord] = {
    "ABEV3": AliasRecord("ABEV3.SA", yahoo_symbol="ABEV3.SA", twelve_data_symbol="ABEV3.SA", exchange="B3", country="Brazil", region="LATAM", confidence="exact_match"),
    "EMBR3": AliasRecord("EMBR3.SA", yahoo_symbol="EMBR3.SA", twelve_data_symbol="EMBR3.SA", exchange="B3", country="Brazil", region="LATAM", confidence="exact_match"),
    "ITUB4": AliasRecord("ITUB4.SA", yahoo_symbol="ITUB4.SA", twelve_data_symbol="ITUB4.SA", exchange="B3", country="Brazil", region="LATAM", confidence="exact_match"),
    "MGLU3": AliasRecord("MGLU3.SA", yahoo_symbol="MGLU3.SA", twelve_data_symbol="MGLU3.SA", exchange="B3", country="Brazil", region="LATAM", confidence="exact_match"),
    "VALE3": AliasRecord("VALE3.SA", yahoo_symbol="VALE3.SA", twelve_data_symbol="VALE3.SA", exchange="B3", country="Brazil", region="LATAM", confidence="exact_match"),
    "CENCOSUD": AliasRecord("CENCOSUD.SN", yahoo_symbol="CENCOSUD.SN", twelve_data_symbol="CENCOSUD.SN", exchange="SSE Chile", country="Chile", region="LATAM", confidence="exact_match"),
    "COLBUN": AliasRecord("COLBUN.SN", yahoo_symbol="COLBUN.SN", twelve_data_symbol="COLBUN.SN", exchange="SSE Chile", country="Chile", region="LATAM", confidence="exact_match"),
    "COPEC": AliasRecord("COPEC.SN", yahoo_symbol="COPEC.SN", twelve_data_symbol="COPEC.SN", exchange="SSE Chile", country="Chile", region="LATAM", confidence="exact_match"),
    "LTM": AliasRecord("LTM.SN", yahoo_symbol="LTM.SN", twelve_data_symbol="LTM.SN", exchange="SSE Chile", country="Chile", region="LATAM", confidence="exact_match"),
    "SMU": AliasRecord("SMU.SN", yahoo_symbol="SMU.SN", twelve_data_symbol="SMU.SN", exchange="SSE Chile", country="Chile", region="LATAM", confidence="exact_match"),
    "VAPORES": AliasRecord("VAPORES.SN", yahoo_symbol="VAPORES.SN", twelve_data_symbol="VAPORES.SN", exchange="SSE Chile", country="Chile", region="LATAM", confidence="exact_match"),
    "BIMBOA": AliasRecord("BIMBOA.MX", yahoo_symbol="BIMBOA.MX", twelve_data_symbol="BIMBOA.MX", exchange="BMV", country="Mexico", region="LATAM", confidence="exact_match"),
    "CMRB": AliasRecord("CMRB.MX", yahoo_symbol="CMRB.MX", twelve_data_symbol="CMRB.MX", exchange="BMV", country="Mexico", region="LATAM", confidence="exact_match"),
    "FEMSA": AliasRecord("FEMSAUBD.MX", yahoo_symbol="FEMSAUBD.MX", twelve_data_symbol="FEMSAUBD.MX", exchange="BMV", country="Mexico", region="LATAM"),
    "GMEXI": AliasRecord("GMEXICOB.MX", yahoo_symbol="GMEXICOB.MX", twelve_data_symbol="GMEXICOB.MX", exchange="BMV", country="Mexico", region="LATAM"),
    "NEMAK": AliasRecord("NEMAKA.MX", yahoo_symbol="NEMAKA.MX", twelve_data_symbol="NEMAKA.MX", exchange="BMV", country="Mexico", region="LATAM"),
    "POCHTEC": AliasRecord("POCHTECB.MX", yahoo_symbol="POCHTECB.MX", twelve_data_symbol="POCHTECB.MX", exchange="BMV", country="Mexico", region="LATAM"),
    "TRAXIONA": AliasRecord("TRAXIONA.MX", yahoo_symbol="TRAXIONA.MX", twelve_data_symbol="TRAXIONA.MX", exchange="BMV", country="Mexico", region="LATAM", confidence="exact_match"),
    "WALME": AliasRecord("WALMEX.MX", yahoo_symbol="WALMEX.MX", twelve_data_symbol="WALMEX.MX", exchange="BMV", country="Mexico", region="LATAM"),
}


ROW_STOCK_ALIASES: dict[str, AliasRecord] = {
    "BAJAJFINSV": AliasRecord("BAJAJFINSV.NS", yahoo_symbol="BAJAJFINSV.NS", twelve_data_symbol="BAJAJFINSV.NS", exchange="NSE", country="India", region="ROW", confidence="exact_match"),
    "MARUTI": AliasRecord("MARUTI.NS", yahoo_symbol="MARUTI.NS", twelve_data_symbol="MARUTI.NS", exchange="NSE", country="India", region="ROW", confidence="exact_match"),
    "MRF": AliasRecord("MRF.NS", yahoo_symbol="MRF.NS", twelve_data_symbol="MRF.NS", exchange="NSE", country="India", region="ROW", confidence="exact_match"),
    "RELIANCE": AliasRecord("RELIANCE.NS", yahoo_symbol="RELIANCE.NS", twelve_data_symbol="RELIANCE.NS", exchange="NSE", country="India", region="ROW", confidence="exact_match"),
    "TATAMOTORS": AliasRecord("TATAMOTORS.NS", yahoo_symbol="TATAMOTORS.NS", twelve_data_symbol="TATAMOTORS.NS", exchange="NSE", country="India", region="ROW", confidence="exact_match"),
}


MIDEAST_EXPLICIT_ALIASES: dict[str, AliasRecord] = {
    "ETISALAT": AliasRecord(
        "EAND.AD",
        yahoo_symbol="EAND.AD",
        twelve_data_symbol="EAND.AD",
        exchange="ADX",
        country="United Arab Emirates",
        region="MIDEAST",
        confidence="heuristic_match",
        notes=("Mapped to e& / Emirates Telecommunications Group listing.",),
    ),
    "BOUBYAN": AliasRecord(
        "BOUBYAN.KW",
        yahoo_symbol="BOUBYAN.KW",
        twelve_data_symbol="BOUBYAN.KW",
        exchange="Boursa Kuwait",
        country="Kuwait",
        region="MIDEAST",
        confidence="heuristic_match",
    ),
}


MIDEAST_UAE_ADX_SYMBOLS = {
    "ADAVIATION",
    "ADCB",
    "ADIB",
    "ADNOCDIST",
    "ADPORTS",
    "FAB.AD",
}

MIDEAST_UAE_DFM_SYMBOLS = {
    "ALANSARI",
    "ARMX",
    "BOS",
    "DIB",
    "DTC",
    "EMAAR",
    "EMIRATESNBD",
    "LULU",
    "PARKIN",
    "PHX",
    "SALIK",
    "SIB",
    "TALABAT",
}

MIDEAST_QATAR_SYMBOLS = {
    "ABQK",
    "BARWA",
    "DHBK",
    "MASRAF",
    "MAZAYA",
    "QAMC",
    "QFLS",
    "QNCD",
    "QNNS",
    "VFQS",
    "IQCD",
    "QEWS",
    "QIBK",
    "QNBK",
}

MIDEAST_OMAN_SYMBOLS = {"BKMB", "BKSB", "NGCI"}


CRYPTO_COIN_IDS: dict[str, str] = {
    "ADAUSD": "cardano",
    "BCHUSD": "bitcoin-cash",
    "BNBUSD": "binancecoin",
    "BTCUSD": "bitcoin",
    "DASHUSD": "dash",
    "DOGEUSD": "dogecoin",
    "DOTUSD": "polkadot",
    "ETHUSD": "ethereum",
    "LINKUSD": "chainlink",
    "LTCUSD": "litecoin",
    "MANAUSD": "decentraland",
    "SANDUSD": "the-sandbox",
    "SOLUSD": "solana",
    "SUIUSD": "sui",
    "TRUMPUSD": "official-trump",
    "TRXUSD": "tron",
    "XMRUSD": "monero",
    "XRPUSD": "ripple",
}


CRYPTO_BINANCE_SYMBOLS: dict[str, str] = {
    "ADAUSD": "ADAUSDT",
    "BCHUSD": "BCHUSDT",
    "BNBUSD": "BNBUSDT",
    "BTCUSD": "BTCUSDT",
    "DOGEUSD": "DOGEUSDT",
    "DOTUSD": "DOTUSDT",
    "ETHUSD": "ETHUSDT",
    "LINKUSD": "LINKUSDT",
    "LTCUSD": "LTCUSDT",
    "MANAUSD": "MANAUSDT",
    "SANDUSD": "SANDUSDT",
    "SOLUSD": "SOLUSDT",
    "SUIUSD": "SUIUSDT",
    "TRXUSD": "TRXUSDT",
    "XRPUSD": "XRPUSDT",
}


METAL_ALIASES: dict[str, AliasRecord] = {
    "COPPER-CASH": AliasRecord("COPPER", "Copper", "HG=F", "HG1!", stooq_symbol="hg.f", confidence="heuristic_match", notes=("Copper cash is mapped to copper futures proxies.",)),
    "XPDUSD": AliasRecord("XPD/USD", "XPD/USD", "PA=F", "XPD/USD", stooq_symbol="xpdusd", confidence="high_confidence_alias"),
    "XPTUSD": AliasRecord("XPT/USD", "XPT/USD", "PL=F", "XPT/USD", stooq_symbol="xptusd", confidence="high_confidence_alias"),
    "XAGUSD": AliasRecord("XAG/USD", "XAG/USD", "SI=F", "XAG/USD", stooq_symbol="xagusd", confidence="high_confidence_alias"),
    "XAUUSD": AliasRecord("XAU/USD", "XAU/USD", "GC=F", "XAU/USD", stooq_symbol="xauusd", confidence="high_confidence_alias"),
}


INDEX_ALIASES: dict[str, AliasRecord] = {
    "ASX-CASH": AliasRecord("ASX200", "ASX 200", "^AXJO", "ASX200", stooq_symbol="^asx", confidence="high_confidence_alias"),
    "CAC-CASH": AliasRecord("CAC40", "CAC 40", "^FCHI", "CAC40", stooq_symbol="^cac", confidence="high_confidence_alias"),
    "DAX-CASH": AliasRecord("DAX40", "DAX 40", "^GDAXI", "DAX", stooq_symbol="^dax", confidence="high_confidence_alias"),
    "EUSX-CASH": AliasRecord("SX5E", "Euro Stoxx 50", "^STOXX50E", "STOXX50", confidence="heuristic_match", notes=("Mapped to Euro Stoxx 50 benchmark.",)),
    "IBEX-CASH": AliasRecord("IBEX35", "IBEX 35", "^IBEX", "IBEX35", confidence="high_confidence_alias"),
    "MIB-CASH": AliasRecord("FTSEMIB", "FTSE MIB", "FTSEMIB.MI", "FTSEMIB", confidence="high_confidence_alias"),
    "SMI-CASH": AliasRecord("SMI20", "SMI 20", "^SSMI", "SMI", confidence="high_confidence_alias"),
    "FTSE-CASH": AliasRecord("FTSE100", "FTSE 100", "^FTSE", "FTSE", stooq_symbol="^ftx", confidence="high_confidence_alias"),
    "DXY-CASH": AliasRecord("DXY", "US Dollar Index", "DX-Y.NYB", "DXY", stooq_symbol="^dxy", confidence="high_confidence_alias", notes=("FRED macro proxy can also be used for dollar index context.",)),
    "DOW-CASH": AliasRecord("DJI", "Dow Jones Industrial Average", "^DJI", "DJI", stooq_symbol="^dji", confidence="high_confidence_alias"),
    "NK-CASH": AliasRecord("N225", "Nikkei 225", "^N225", "NI225", stooq_symbol="^nkx", confidence="high_confidence_alias"),
    "NSDQ-CASH": AliasRecord("NDX", "Nasdaq 100", "^NDX", "NDX", stooq_symbol="^ndx", confidence="high_confidence_alias"),
    "RTY-CASH": AliasRecord("RUT", "Russell 2000", "^RUT", "RUT", stooq_symbol="^rut", confidence="high_confidence_alias"),
    "SP-CASH": AliasRecord("SPX", "S&P 500", "^GSPC", "SPX", stooq_symbol="^spx", confidence="high_confidence_alias"),
}


COMMODITY_ALIASES: dict[str, AliasRecord] = {
    "BRNT-CASH": AliasRecord("BRENT", "Brent Crude Oil", "BZ=F", "BZ1!", stooq_symbol="cb.f", confidence="heuristic_match", notes=("Mapped to Brent front-month futures proxy.",)),
    "CL-CASH": AliasRecord("WTI", "WTI Crude Oil", "CL=F", "CL1!", stooq_symbol="cl.f", confidence="heuristic_match", notes=("Mapped to WTI front-month futures proxy.",)),
    "NGAS-CASH": AliasRecord("NATGAS", "Natural Gas", "NG=F", "NG1!", stooq_symbol="ng.f", confidence="heuristic_match", notes=("Mapped to Henry Hub natural gas futures proxy.",)),
    "COCOA-CASH": AliasRecord("COCOA", "Cocoa", "CC=F", stooq_symbol="cc.f", confidence="heuristic_match"),
    "COFFEE-CASH": AliasRecord("COFFEE", "Coffee", "KC=F", stooq_symbol="kc.f", confidence="heuristic_match"),
    "CORN-CASH": AliasRecord("CORN", "Corn", "ZC=F", stooq_symbol="zc.f", confidence="heuristic_match"),
    "COTTON-CASH": AliasRecord("COTTON", "Cotton", "CT=F", stooq_symbol="ct.f", confidence="heuristic_match"),
    "SBEAN-CASH": AliasRecord("SOYBEAN", "Soybeans", "ZS=F", stooq_symbol="zs.f", confidence="heuristic_match"),
    "SUGAR-CASH": AliasRecord("SUGAR", "Sugar", "SB=F", stooq_symbol="sb.f", confidence="heuristic_match"),
    "WHEAT-CASH": AliasRecord("WHEAT", "Wheat", "ZW=F", stooq_symbol="zw.f", confidence="heuristic_match"),
    "LUMBER-CASH": AliasRecord("LUMBER", "Lumber", "LBS=F", confidence="heuristic_match", notes=("Yahoo coverage for lumber futures can be intermittent.",)),
}
