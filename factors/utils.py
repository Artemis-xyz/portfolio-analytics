# Imports
import logging
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import dotenv
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import requests
import statsmodels.api as sm
import yfinance as yf

from artemis import Artemis

# Env Variables
dotenv.load_dotenv("../../.env.local")
API_KEY = os.getenv("ARTEMIS_API_KEY")

logger = logging.getLogger(__name__)


# =============================================================================
# Symbol Mappings
# =============================================================================

ARTEMIS_TO_COINBASE_MAP = {
    "bitcoin": "BTC-USD",
    "ethereum": "ETH-USD",
    "solana": "SOL-USD",
    "cardano": "ADA-USD",
    "avalanche": "AVAX-USD",
    "polkadot": "DOT-USD",
    "chainlink": "LINK-USD",
    "polygon": "POL-USD",
    "litecoin": "LTC-USD",
    "uniswap": "UNI-USD",
    "stellar": "XLM-USD",
    "cosmos": "ATOM-USD",
    "near": "NEAR-USD",
    "algorand": "ALGO-USD",
    "filecoin": "FIL-USD",
    "internet-computer": "ICP-USD",
    "aptos": "APT-USD",
    "arbitrum": "ARB-USD",
    "optimism": "OP-USD",
    "sui": "SUI-USD",
    "hedera": "HBAR-USD",
    "aave": "AAVE-USD",
    "maker": "MKR-USD",
    "render": "RENDER-USD",
    "injective": "INJ-USD",
    "sei": "SEI-USD",
    "celestia": "TIA-USD",
    "stacks": "STX-USD",
    "the-graph": "GRT-USD",
    "eos": "EOS-USD",
    "flow": "FLOW-USD",
    "axie-infinity": "AXS-USD",
    "decentraland": "MANA-USD",
    "the-sandbox": "SAND-USD",
    "enjin-coin": "ENJ-USD",
    "gala": "GALA-USD",
    "immutable-x": "IMX-USD",
    "lido-dao": "LDO-USD",
    "rocket-pool": "RPL-USD",
    "compound": "COMP-USD",
    "sushi": "SUSHI-USD",
    "1inch": "1INCH-USD",
    "curve-dao-token": "CRV-USD",
    "yearn-finance": "YFI-USD",
    "synthetix": "SNX-USD",
    "fetch-ai": "FET-USD",
    "ocean-protocol": "OCEAN-USD",
    "theta": "THETA-USD",
    "tezos": "XTZ-USD",
    "iota": "IOTA-USD",
    "zcash": "ZEC-USD",
    "dash": "DASH-USD",
    "ethereum-classic": "ETC-USD",
    "bitcoin-cash": "BCH-USD",
    "dogecoin": "DOGE-USD",
    "shiba-inu": "SHIB-USD",
    "pepe": "PEPE-USD",
    "bonk": "BONK-USD",
    "floki": "FLOKI-USD",
    "jasmy": "JASMY-USD",
    "chiliz": "CHZ-USD",
    "mask-network": "MASK-USD",
    "blur": "BLUR-USD",
    "worldcoin": "WLD-USD",
    "jupiter": "JUP-USD",
    "pyth-network": "PYTH-USD",
    "jito": "JTO-USD",
    "dydx": "DYDX-USD",
    "gmx": "GMX-USD",
    "raydium": "RAY-USD",
    "ondo-finance": "ONDO-USD",
    "ethena": "ENA-USD",
    "pendle": "PENDLE-USD",
    "eigen-layer": "EIGEN-USD",
    "zksync": "ZK-USD",
    "scroll": "SCR-USD",
    "mantle": "MNT-USD",
    "ton": "TON-USD",
    "tron": "TRX-USD",
    "xrp": "XRP-USD",
}

COINGECKO_TO_YFINANCE_MAP = {
    "bitcoin": "BTC-USD",
    "ethereum": "ETH-USD",
    "solana": "SOL-USD",
    "cardano": "ADA-USD",
    "avalanche-2": "AVAX-USD",
    "polkadot": "DOT-USD",
    "chainlink": "LINK-USD",
    "matic-network": "POL-USD",
    "litecoin": "LTC-USD",
    "uniswap": "UNI-USD",
    "stellar": "XLM-USD",
    "cosmos": "ATOM-USD",
    "near": "NEAR-USD",
    "algorand": "ALGO-USD",
    "filecoin": "FIL-USD",
    "internet-computer": "ICP-USD",
    "aptos": "APT-USD",
    "arbitrum": "ARB-USD",
    "optimism": "OP-USD",
    "sui": "SUI-USD",
    "hedera-hashgraph": "HBAR-USD",
    "aave": "AAVE-USD",
    "maker": "MKR-USD",
    "render-token": "RENDER-USD",
    "injective-protocol": "INJ-USD",
    "sei-network": "SEI-USD",
    "celestia": "TIA-USD",
    "blockstack": "STX-USD",
    "the-graph": "GRT-USD",
    "eos": "EOS-USD",
    "flow": "FLOW-USD",
    "axie-infinity": "AXS-USD",
    "decentraland": "MANA-USD",
    "the-sandbox": "SAND-USD",
    "enjincoin": "ENJ-USD",
    "gala": "GALA-USD",
    "immutable-x": "IMX-USD",
    "lido-dao": "LDO-USD",
    "rocket-pool": "RPL-USD",
    "compound-governance-token": "COMP-USD",
    "sushi": "SUSHI-USD",
    "1inch": "1INCH-USD",
    "curve-dao-token": "CRV-USD",
    "yearn-finance": "YFI-USD",
    "havven": "SNX-USD",
    "fetch-ai": "FET-USD",
    "ocean-protocol": "OCEAN-USD",
    "theta-token": "THETA-USD",
    "tezos": "XTZ-USD",
    "iota": "IOTA-USD",
    "zcash": "ZEC-USD",
    "dash": "DASH-USD",
    "ethereum-classic": "ETC-USD",
    "bitcoin-cash": "BCH-USD",
    "dogecoin": "DOGE-USD",
    "shiba-inu": "SHIB-USD",
    "pepe": "PEPE-USD",
    "bonk": "BONK-USD",
    "floki": "FLOKI-USD",
    "jasmy": "JASMY-USD",
    "chiliz": "CHZ-USD",
    "blur": "BLUR-USD",
    "worldcoin-wld": "WLD-USD",
    "jupiter-exchange-solana": "JUP-USD",
    "pyth-network": "PYTH-USD",
    "jito-governance-token": "JTO-USD",
    "dydx-chain": "DYDX-USD",
    "gmx": "GMX-USD",
    "raydium": "RAY-USD",
    "ondo-finance": "ONDO-USD",
    "ethena": "ENA-USD",
    "pendle": "PENDLE-USD",
    "ripple": "XRP-USD",
    "tron": "TRX-USD",
    "toncoin": "TON-USD",
    "mantle": "MNT-USD",
}


class CoinbaseData:
    """Fetch crypto OHLCV data from Coinbase Advanced Trade public REST API."""

    BASE_URL = "https://api.coinbase.com/api/v3/brokerage/market"
    MAX_CANDLES_PER_REQUEST = 300
    RATE_LIMIT_DELAY = 0.1  # 10 req/sec

    def __init__(self):
        self._session = requests.Session()
        self._products_cache = None

    def list_products(self, quote_currency: str = "USD") -> list[dict]:
        """List all spot trading pairs for a given quote currency, cached."""
        if self._products_cache is not None:
            return self._products_cache

        url = "https://api.coinbase.com/api/v3/brokerage/market/products"
        params = {"product_type": "SPOT", "limit": 500}
        all_products = []
        offset = 0

        while True:
            params["offset"] = offset
            resp = self._session.get(url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            products = data.get("products", [])
            if not products:
                break
            all_products.extend(products)
            if len(products) < 500:
                break
            offset += len(products)
            time.sleep(self.RATE_LIMIT_DELAY)

        self._products_cache = [
            p for p in all_products if p.get("quote_currency_id") == quote_currency
        ]
        return self._products_cache

    def get_candles(
        self, product_id: str, start_date: str, end_date: str
    ) -> pd.DataFrame:
        """
        Fetch daily OHLCV candles with pagination (300 candles/request).

        Args:
            product_id: e.g. "BTC-USD"
            start_date: YYYY-MM-DD
            end_date: YYYY-MM-DD

        Returns:
            DataFrame with columns [date, open, high, low, close, volume]
        """
        url = f"{self.BASE_URL}/products/{product_id}/candles"
        start_dt = pd.Timestamp(start_date)
        end_dt = pd.Timestamp(end_date)

        all_candles = []
        current_start = start_dt

        while current_start < end_dt:
            # Each request covers up to 300 days
            current_end = min(
                current_start + pd.Timedelta(days=self.MAX_CANDLES_PER_REQUEST - 1),
                end_dt,
            )

            params = {
                "start": str(int(current_start.timestamp())),
                "end": str(int(current_end.timestamp())),
                "granularity": "ONE_DAY",
            }

            for attempt in range(3):
                try:
                    resp = self._session.get(url, params=params, timeout=30)
                    resp.raise_for_status()
                    break
                except requests.exceptions.RequestException as e:
                    if attempt == 2:
                        logger.warning(
                            f"Failed to fetch candles for {product_id} "
                            f"({current_start.date()} to {current_end.date()}): {e}"
                        )
                        break
                    time.sleep(2 ** attempt)

            if resp.status_code == 200:
                candles = resp.json().get("candles", [])
                all_candles.extend(candles)

            current_start = current_end + pd.Timedelta(days=1)
            time.sleep(self.RATE_LIMIT_DELAY)

        if not all_candles:
            return pd.DataFrame(columns=["date", "open", "high", "low", "close", "volume"])

        df = pd.DataFrame(all_candles)
        df["date"] = pd.to_datetime(df["start"].astype(int), unit="s")
        df = df.rename(columns={"close": "close", "open": "open", "high": "high", "low": "low"})
        df["volume"] = pd.to_numeric(df["volume"], errors="coerce")
        df["close"] = pd.to_numeric(df["close"], errors="coerce")
        df["open"] = pd.to_numeric(df["open"], errors="coerce")
        df["high"] = pd.to_numeric(df["high"], errors="coerce")
        df["low"] = pd.to_numeric(df["low"], errors="coerce")
        df = df[["date", "open", "high", "low", "close", "volume"]]
        df = df.sort_values("date").drop_duplicates(subset=["date"]).reset_index(drop=True)
        return df

    def get_price_volume_for_symbols(
        self,
        symbols: list[str],
        start_date: str,
        end_date: str,
        symbol_map: dict | None = None,
    ) -> pd.DataFrame:
        """
        Batch fetch price + volume for multiple Artemis symbols.

        Args:
            symbols: List of Artemis slugs (e.g. ["bitcoin", "ethereum"])
            start_date: YYYY-MM-DD
            end_date: YYYY-MM-DD
            symbol_map: Mapping from Artemis slug to Coinbase product ID.
                        Defaults to ARTEMIS_TO_COINBASE_MAP.

        Returns:
            DataFrame with columns [date, asset, price, 24h_volume]
        """
        if symbol_map is None:
            symbol_map = ARTEMIS_TO_COINBASE_MAP

        records = []
        unmapped = []

        for symbol in symbols:
            product_id = symbol_map.get(symbol)
            if not product_id:
                unmapped.append(symbol)
                continue

            candles = self.get_candles(product_id, start_date, end_date)
            if candles.empty:
                continue

            for _, row in candles.iterrows():
                records.append(
                    {
                        "date": row["date"],
                        "asset": symbol,
                        "price": row["close"],
                        "24h_volume": row["volume"],
                    }
                )

        if unmapped:
            logger.info(f"Unmapped Artemis symbols (no Coinbase pair): {unmapped}")

        if not records:
            return pd.DataFrame(columns=["date", "asset", "price", "24h_volume"])

        df = pd.DataFrame(records)
        df["date"] = pd.to_datetime(df["date"])
        return df


def build_artemis_to_coinbase_map(validate: bool = False) -> dict:
    """
    Return the hardcoded ARTEMIS_TO_COINBASE_MAP, optionally validating
    against the live Coinbase product list.
    """
    if not validate:
        return dict(ARTEMIS_TO_COINBASE_MAP)

    cb = CoinbaseData()
    live_products = {p["product_id"] for p in cb.list_products()}
    validated = {}
    for artemis_slug, product_id in ARTEMIS_TO_COINBASE_MAP.items():
        if product_id in live_products:
            validated[artemis_slug] = product_id
        else:
            logger.warning(f"Coinbase product {product_id} not found for {artemis_slug}")
    return validated


class ApiData:
    """Class to pull and format data from Artemis API"""

    def __init__(self, api_key):
        self.api_key = api_key
        self.client = Artemis(api_key=api_key)

    def get_all_metrics_for_symbol(self, symbol: str) -> list:
        """Get all metrics for a symbol"""
        available_metrics = []
        supported_metrics = self.client.asset.list_supported_metrics(
            symbol=symbol
        ).metrics
        for i in supported_metrics:
            for key in i.keys():
                available_metrics.append(key)
        return available_metrics

    def get_metric_for_all_symbols(
        self, metrics: list, start_date: str, end_date: str
    ) -> pd.DataFrame:
        """Get all metrics for all symbols between start and end date"""
        all_assets = self.client.asset.list_asset_symbols()
        symbols = [
            asset.get("symbol")
            for asset in all_assets["assets"]
            if asset.get("symbol") is not None
        ]

        # get rid of equity symbols (that contain eq-)
        symbols = [
            symbol
            for symbol in symbols
            if "eq-" not in symbol
            and "usd" not in symbol
            and symbol != "M"
            and symbol != "eurc"
        ]  # filter out equities and stablecoins
        metrics = ",".join(metrics)

        symbol_batch_size = 5  # 250 asset limit per request
        full_data_dict = {}
        failed_symbols = []

        for i in range(0, len(symbols), symbol_batch_size):
            batch = symbols[i : i + symbol_batch_size]
            try:
                metrics_for_asset = self.client.fetch_metrics(
                    api_key=self.api_key,
                    metric_names=metrics,
                    symbols=batch,
                    start_date=start_date,
                    end_date=end_date,
                )
                full_data_dict.update(metrics_for_asset.data.symbols)
                time.sleep(1)
            except Exception as e:
                print(f"Error getting metrics for {batch}: {e}")
                failed_symbols.extend(batch)
                continue

        records = []
        for asset, metrics_dict in full_data_dict.items():
            for metric, values in metrics_dict.items():
                for item in values:
                    # Handle both dict and object types
                    if isinstance(item, dict):
                        item_date = item.get("date") or item.get("timestamp")
                        item_value = item.get("val")
                    else:
                        # Handle DataSymbolsDataSymbolsItem objects
                        item_date = getattr(item, "date", None) or getattr(item, "timestamp", None)
                        item_value = getattr(item, "val", None)
                    
                    if item_date is None or item_value is None:
                        continue
                    
                    # Convert date to string if it's a date object
                    if hasattr(item_date, 'strftime'):
                        item_date = item_date.strftime("%Y-%m-%d")
                    elif isinstance(item_date, str):
                        item_date = item_date
                    else:
                        item_date = str(item_date)
                    
                    records.append(
                        {
                            "date": item_date,
                            "asset": asset,
                            "metric": metric,
                            "value": item_value,
                        }
                    )

        df = pd.DataFrame(records)

        if df.empty:
            raise ValueError(
                "No data returned from Artemis API for the requested metrics. "
                "Verify API key, metric names, and date range."
            )

        required_columns = {"date", "asset", "metric", "value"}
        missing_columns = required_columns - set(df.columns)
        if missing_columns:
            raise ValueError(
                f"Artemis API response is missing expected fields: {missing_columns}. "
                "Unable to pivot data."
            )

        # pivot df to get metrics as columns and perform light transformations
        pivoted_df = df.pivot(
            index=["date", "asset"], columns="metric", values="value"
        ).reset_index()

        pivoted_df.columns.name = None
        pivoted_df["date"] = pd.to_datetime(pivoted_df["date"])
        pivoted_df = pivoted_df.set_index("date")
        return pivoted_df


class FactorModel:
    """ "Class to format and prep data for factor modeling and track factor constituents per period"""

    def __init__(
        self,
        df: pd.DataFrame,
        factor: str,
        breakpoint: Optional[float] = None,
        min_assets: Optional[int] = None,
        weighting_method: Optional[str] = None,
    ):
        self.factor = factor
        self.df = df
        self.min_assets = min_assets
        self.breakpoint = breakpoint
        self.weighting_method = weighting_method
        self.factor_returns = {}  # {date: return}}
        self.long_portfolio_returns = {}  # {date: return}
        self.short_portfolio_returns = {}  # {date: return}
        self.factor_assets = {}  # {date: {long_portfolio: {asset: {weighting: weighting, price_pct_change: price_pct_change}}, short_portfolio: {asset: {weighting: weighting, price_pct_change: price_pct_change}}}}
        self.run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.results_dict = {}

    def resample(self, freq: str, metric_agg_methods: dict):
        """Helper to resample the df to a given frequency (ie: W, M, etc.)"""
        self.df = (
            self.df.groupby("asset")
            .resample(freq)
            .agg(metric_agg_methods)
            .reset_index()
            .sort_values(["date", "asset"])
        )

    def calculate_price_pct_change(self, periods: int = 1):
        """Helper to calculate the price pct change for each asset"""
        self.df[f"price_pct_change_p{periods}"] = self.df.groupby("asset")[
            "price"
        ].pct_change(periods=periods)

    def get_t_minus_1_metrics(self, metrics: list):
        """Helper to get the t-1 metrics for each asset. The t-1 metric is used for rebalancing."""
        for metric in metrics:
            self.df[f"{metric}_t_minus_{1}"] = self.df.groupby("asset")[metric].shift(1)

    # TODO: Make these threshold functions more robust; Need to look at threshold satisfaction over min number of periods for qualification
    def market_cap_threshold(self, threshold: int):
        """Helper to filter assets based on market cap threshold"""
        self.df = self.df[self.df["mc_t_minus_1"] > threshold]

    def liquidity_threshold(self, threshold: int):
        """Helper to filter assets based on liquidity threshold. I'm using 24h_volume as a proxy for liquidity."""
        self.df = self.df[self.df["24h_volume_t_minus_1"] > threshold]

    def minimum_lifetime(self, days: int):
        """Helper to filter assets based on minimum lifetime"""
        self.df["min_asset_date"] = self.df.groupby("asset")["date"].transform("min")
        self.df = self.df[
            self.df["date"] - self.df["min_asset_date"] >= pd.Timedelta(days=days)
        ]

    def calculate_variance(self, returns_col: str = "price_pct_change_p1"):
        """Helper to calculate variance and inverse variance for each asset over entire history."""
        self.df["variance"] = self.df.groupby("asset")[returns_col].transform("var")
        self.df["inverse_variance"] = 1 / self.df["variance"]
        # Replace inf with NaN for cleaner handling
        self.df["inverse_variance"] = self.df["inverse_variance"].replace(
            [np.inf, -np.inf], np.nan
        )

    def get_weighted_return(
        self, portfolio_df: pd.DataFrame, returns_col: str = "price_pct_change_p1"
    ) -> float:
        """
        Calculate weighted return for a portfolio based on weighting_method.

        Supports: 'equal', 'market_cap', 'inverse_variance'
        """
        if self.weighting_method == "equal":
            return portfolio_df[returns_col].mean()
        elif self.weighting_method == "market_cap":
            weights = portfolio_df["mc_t_minus_1"].astype(float)
            numerator = (portfolio_df[returns_col].astype(float) * weights).sum()
            denominator = weights.sum()
            return numerator / denominator if denominator != 0 else np.nan
        elif self.weighting_method == "inverse_variance":
            if "inverse_variance" not in portfolio_df.columns:
                raise ValueError(
                    "inverse_variance column not found. Call calculate_variance() first."
                )
            weights = portfolio_df["inverse_variance"].astype(float)
            numerator = (portfolio_df[returns_col].astype(float) * weights).sum()
            denominator = weights.sum()
            return numerator / denominator if denominator != 0 else np.nan
        else:
            # Default to equal weighting
            return portfolio_df[returns_col].mean()

    def get_asset_beta(
        self, asset: str, min_observations: int = 52, asset_type: str = "crypto"
    ) -> float:
        if not self.factor_returns:
            print(f"No factor returns data available for asset {asset}")
            return np.nan

        factor_returns_series = pd.Series(self.factor_returns)
        factor_returns_series.index = pd.to_datetime(factor_returns_series.index)

        start_date = factor_returns_series.index.min().strftime("%Y-%m-%d")
        end_date = factor_returns_series.index.max().strftime("%Y-%m-%d")

        try:
            if asset_type == "crypto":
                asset_data = get_coin_price_series(asset, start_date, end_date)
                # Use uppercase column names: TRADE_DATE, PRICE, DAILY_RETURN
                asset_returns = asset_data.set_index("TRADE_DATE")

                # Use DAILY_RETURN if available, otherwise calculate from PRICE
                if "DAILY_RETURN" in asset_returns.columns:
                    asset_returns = asset_returns["DAILY_RETURN"].dropna()
                else:
                    asset_returns = asset_returns["PRICE"].pct_change().dropna()
            else:
                asset_data = get_equity_data(asset, start_date, end_date)
                # Equity uses lowercase 'date' and 'equity_price' based on the query
                asset_returns = (
                    asset_data.set_index("date")["equity_price"].pct_change().dropna()
                )

            if len(asset_returns) == 0:
                print(f"No returns data available for asset {asset}")
                return np.nan

            asset_returns.index = pd.to_datetime(asset_returns.index)
            aligned_data = pd.DataFrame(
                {"asset_return": asset_returns, "factor_return": factor_returns_series}
            )

            aligned_data = aligned_data.dropna()

            if len(aligned_data) < min_observations:
                print(f"Not enough observations to calculate beta for asset {asset}")
                return np.nan

            y = aligned_data["asset_return"].values
            X = aligned_data["factor_return"].values

            X_with_const = sm.add_constant(X)
            model = sm.OLS(y, X_with_const).fit()

            beta = model.params[1]
            return beta

        except Exception as e:
            print(f"Error calculating beta for asset {asset}: {e}")
            return np.nan

    def get_portfolio_beta(
        self,
        portfolio: dict[str, float],  # e.g., {"BTC": 0.5, "ETH": 10, "SOL": 100} - amounts, not weights
        symbol_to_coingecko: dict = None,  # Optional: {"BTC": "bitcoin", "ETH": "ethereum"}
        min_observations: int = 52,
        asset_type: str = "crypto",
    ) -> float:
        """
        Calculate the beta of a portfolio (defined by coin amounts) against factor returns.

        Args:
            portfolio: Dictionary mapping asset symbols to amounts (not weights)
                    e.g., {"BTC": 0.5, "ETH": 10, "SOL": 100}
                    or {"bitcoin": 0.5, "ethereum": 10, "solana": 100} if using CoinGecko IDs directly
            symbol_to_coingecko: Optional mapping from symbols to CoinGecko IDs
                            e.g., {"BTC": "bitcoin", "ETH": "ethereum", "SOL": "solana"}
                            If None, assumes portfolio keys are already CoinGecko IDs
            min_observations: Minimum number of observations required for regression
            asset_type: Type of assets ("crypto" or "equity")

        Returns:
            Portfolio beta coefficient from OLS regression against factor returns
        """
        if not self.factor_returns:
            print("No factor returns data available")
            return np.nan

        if not portfolio:
            print("Portfolio is empty")
            return np.nan

        # Convert symbols to CoinGecko IDs if mapping provided
        if symbol_to_coingecko:
            portfolio_coingecko = {}
            for symbol, amount in portfolio.items():
                if symbol in symbol_to_coingecko:
                    coingecko_id = symbol_to_coingecko[symbol]
                    portfolio_coingecko[coingecko_id] = amount
                else:
                    # If symbol not in mapping, assume it's already a CoinGecko ID
                    portfolio_coingecko[symbol] = amount
            portfolio = portfolio_coingecko

        # Get current prices to calculate portfolio weights
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - pd.Timedelta(days=7)).strftime("%Y-%m-%d")  # Get recent price
        
        portfolio_weights = {}
        total_value = 0
        
        for asset_id, amount in portfolio.items():
            try:
                if asset_type == "crypto":
                    # Get most recent price - same pattern as get_asset_beta
                    asset_data = get_coin_price_series(asset_id, start_date, end_date)
                    if len(asset_data) > 0:
                        # Use uppercase column names: TRADE_DATE, PRICE (same as get_asset_beta)
                        current_price = asset_data["PRICE"].iloc[-1]
                        asset_value = amount * current_price
                        portfolio_weights[asset_id] = asset_value
                        total_value += asset_value
                    else:
                        print(f"Warning: No price data found for {asset_id}")
                else:
                    # For equity, use lowercase column names (same as get_asset_beta)
                    asset_data = get_equity_data(asset_id, start_date, end_date)
                    if len(asset_data) > 0:
                        current_price = asset_data["equity_price"].iloc[-1]
                        asset_value = amount * current_price
                        portfolio_weights[asset_id] = asset_value
                        total_value += asset_value
                    else:
                        print(f"Warning: No price data found for {asset_id}")
            except Exception as e:
                print(f"Error getting price for {asset_id}: {e}")
                continue
        
        if total_value == 0:
            print("Error: Could not calculate portfolio value")
            return np.nan
        
        # Convert to weights (percentages that sum to 1.0)
        normalized_weights = {
            asset_id: value / total_value 
            for asset_id, value in portfolio_weights.items()
        }

        # Get factor returns as a series (same as get_asset_beta)
        factor_returns_series = pd.Series(self.factor_returns)
        factor_returns_series.index = pd.to_datetime(factor_returns_series.index)
        start_date = factor_returns_series.index.min().strftime("%Y-%m-%d")
        end_date = factor_returns_series.index.max().strftime("%Y-%m-%d")

        # Fetch returns for each asset in the portfolio (same pattern as get_asset_beta)
        asset_returns_dict = {}
        try:
            for asset in normalized_weights.keys():
                if asset_type == "crypto":
                    asset_data = get_coin_price_series(asset, start_date, end_date)
                    # Use uppercase column names: TRADE_DATE, PRICE, DAILY_RETURN (same as get_asset_beta)
                    asset_returns = asset_data.set_index("TRADE_DATE")

                    # Use DAILY_RETURN if available, otherwise calculate from PRICE
                    if "DAILY_RETURN" in asset_returns.columns:
                        asset_returns = asset_returns["DAILY_RETURN"].dropna()
                    else:
                        asset_returns = asset_returns["PRICE"].pct_change().dropna()
                else:
                    asset_data = get_equity_data(asset, start_date, end_date)
                    # Equity uses lowercase 'date' and 'equity_price' (same as get_asset_beta)
                    asset_returns = (
                        asset_data.set_index("date")["equity_price"].pct_change().dropna()
                    )

                asset_returns.index = pd.to_datetime(asset_returns.index)
                asset_returns_dict[asset] = asset_returns

            if not asset_returns_dict:
                print("No asset returns data could be fetched")
                return np.nan

            # Combine all asset returns into a DataFrame
            returns_df = pd.DataFrame(asset_returns_dict)

            # Drop dates where any asset has missing data (only use complete observations)
            returns_df = returns_df.dropna()

            if len(returns_df) == 0:
                print("No complete observations across all portfolio assets")
                return np.nan

            # Compute portfolio returns as weighted sum
            portfolio_returns = pd.Series(0.0, index=returns_df.index)
            for asset, weight in normalized_weights.items():
                if asset in returns_df.columns:
                    portfolio_returns += weight * returns_df[asset]

            # Align portfolio returns with factor returns (same pattern as get_asset_beta)
            aligned_data = pd.DataFrame(
                {"portfolio_return": portfolio_returns, "factor_return": factor_returns_series}
            )
            aligned_data = aligned_data.dropna()

            if len(aligned_data) < min_observations:
                print(
                    f"Not enough observations ({len(aligned_data)}) to calculate portfolio beta. "
                    f"Minimum required: {min_observations}"
                )
                return np.nan

            # Run OLS regression: portfolio_returns ~ factor_returns (same as get_asset_beta)
            y = aligned_data["portfolio_return"].values
            X = aligned_data["factor_return"].values
            X_with_const = sm.add_constant(X)
            model = sm.OLS(y, X_with_const).fit()

            beta = model.params[1]
            return beta

        except Exception as e:
            print(f"Error calculating portfolio beta: {e}")
            return np.nan


class Logger:
    """Class to log the results of the factor model to csv"""

    def __init__(self, log_dir: str, factor_model: FactorModel):
        self.log_dir = Path(log_dir)
        self.factor = factor_model.factor
        self.breakpoint = factor_model.breakpoint
        self.min_assets = factor_model.min_assets
        self.weighting_method = factor_model.weighting_method
        self.run_id = factor_model.run_id

    def log_results(self, results_dict: Optional[dict] = None):
        """Helper to log the results to a csv"""
        base_results_dict = {
            "run_id": self.run_id,
            "factor": self.factor,
            "breakpoint": self.breakpoint,
            "min_assets": self.min_assets,
            "weighting_method": self.weighting_method,
        }
        if results_dict is None:
            results_dict = base_results_dict
        else:
            results_dict = {**base_results_dict, **results_dict}

        results_df = pd.DataFrame(results_dict, index=[0])
        file_path = self.log_dir / f"{self.factor}.csv"
        # if directory doesn't exist, create it
        if not self.log_dir.exists():
            self.log_dir.mkdir(parents=True, exist_ok=True)
        file_exists = file_path.exists()
        results_df.to_csv(
            file_path,
            mode="a",  # Append mode
            header=not file_exists,  # Only write header if file doesn't exist
            index=False,
        )


# Util Helper Functions


def get_equity_data(ticker: str, start_date: str, end_date: str) -> pd.DataFrame:
    """
    Get equity price data via yfinance.

    Returns:
        DataFrame with columns [date, equity_price]
    """
    data = yf.download(ticker, start=start_date, end=end_date, progress=False, auto_adjust=True)
    if data.empty:
        return pd.DataFrame(columns=["date", "equity_price"])

    # Handle MultiIndex columns from yfinance
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    df = data[["Close"]].reset_index()
    df = df.rename(columns={"Date": "date", "Close": "equity_price"})
    df["date"] = pd.to_datetime(df["date"])
    return df


def get_coin_price_series(coin: str, start_date: str, end_date: str) -> pd.DataFrame:
    """
    Get price time series for a coin via yfinance.

    Args:
        coin: CoinGecko ID (e.g., 'bitcoin', 'ethereum')
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)

    Returns:
        DataFrame with uppercase columns: TRADE_DATE, PRICE, DAILY_RETURN
        (preserves format expected by get_asset_beta)
    """
    yf_ticker = COINGECKO_TO_YFINANCE_MAP.get(coin.lower())
    if not yf_ticker:
        logger.warning(f"No yfinance mapping for CoinGecko ID: {coin}")
        return pd.DataFrame(columns=["TRADE_DATE", "PRICE", "DAILY_RETURN"])

    data = yf.download(yf_ticker, start=start_date, end=end_date, progress=False, auto_adjust=True)
    if data.empty:
        return pd.DataFrame(columns=["TRADE_DATE", "PRICE", "DAILY_RETURN"])

    # Handle MultiIndex columns from yfinance
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    df = data[["Close"]].reset_index()
    df = df.rename(columns={"Date": "TRADE_DATE", "Close": "PRICE"})
    df["TRADE_DATE"] = pd.to_datetime(df["TRADE_DATE"])
    df["DAILY_RETURN"] = df["PRICE"].pct_change()
    return df


def get_risk_free_rate(
    start_date: str = "2015-01-01",
    end_date: str | None = None,
) -> pd.DataFrame:
    """
    Fetch risk-free rate from ^IRX (13-week T-bill yield) via yfinance.

    Returns:
        DataFrame with DatetimeIndex and columns [rf_apy, rf_weekly].
        rf_apy  = annualized yield (as decimal, e.g. 0.05 for 5%)
        rf_weekly = rf_apy / 52
    """
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d")

    data = yf.download("^IRX", start=start_date, end=end_date, progress=False, auto_adjust=True)
    if data.empty:
        return pd.DataFrame(columns=["rf_apy", "rf_weekly"])

    # Handle MultiIndex columns from yfinance
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    rf_df = data[["Close"]].copy()
    rf_df = rf_df.rename(columns={"Close": "rf_apy"})
    # ^IRX reports yield as percentage (e.g. 5.0 for 5%), convert to decimal
    rf_df["rf_apy"] = rf_df["rf_apy"] / 100.0
    rf_df["rf_weekly"] = rf_df["rf_apy"] / 52
    rf_df.index = pd.to_datetime(rf_df.index)
    rf_df.index.name = "date"
    return rf_df


def fetch_merged_crypto_data(
    start_date: str,
    end_date: str,
    artemis_metrics: list[str] | None = None,
    api_key: str | None = None,
) -> pd.DataFrame:
    """
    Fetch on-chain metrics from Artemis and price+volume from Coinbase,
    then inner-merge on (date, asset).

    Args:
        start_date: YYYY-MM-DD
        end_date: YYYY-MM-DD
        artemis_metrics: Metrics to fetch from Artemis (default: ["mc"]).
                         price and 24h_volume always come from Coinbase.
        api_key: Artemis API key. Defaults to module-level API_KEY.

    Returns:
        DataFrame with index=date, columns=[asset, price, mc, 24h_volume, ...]
    """
    if artemis_metrics is None:
        artemis_metrics = ["mc"]
    if api_key is None:
        api_key = API_KEY

    # 1. Fetch on-chain metrics from Artemis
    api_data = ApiData(api_key)
    artemis_df = api_data.get_metric_for_all_symbols(
        metrics=artemis_metrics,
        start_date=start_date,
        end_date=end_date,
    )
    artemis_df = artemis_df.reset_index()
    artemis_df["date"] = pd.to_datetime(artemis_df["date"])

    # 2. Intersect Artemis symbols with Coinbase-mapped symbols
    artemis_symbols = artemis_df["asset"].unique().tolist()
    coinbase_symbols = [s for s in artemis_symbols if s in ARTEMIS_TO_COINBASE_MAP]

    if not coinbase_symbols:
        raise ValueError(
            "No Artemis symbols have Coinbase mappings. "
            "Check ARTEMIS_TO_COINBASE_MAP coverage."
        )

    logger.info(
        f"Fetching Coinbase data for {len(coinbase_symbols)} symbols "
        f"(out of {len(artemis_symbols)} Artemis symbols)"
    )

    # 3. Fetch price + volume from Coinbase
    cb = CoinbaseData()
    coinbase_df = cb.get_price_volume_for_symbols(
        coinbase_symbols, start_date, end_date
    )

    if coinbase_df.empty:
        raise ValueError("No price/volume data returned from Coinbase.")

    # 4. Inner merge on (date, asset)
    merged = artemis_df.merge(coinbase_df, on=["date", "asset"], how="inner")

    if merged.empty:
        raise ValueError(
            "Merge of Artemis and Coinbase data produced no rows. "
            "Check date alignment and symbol overlap."
        )

    merged = merged.set_index("date")
    return merged


def cumulative_returns(factor_returns):
    """Helper to calculate the cumulative returns for a factor"""
    returns_df = pd.DataFrame(list(factor_returns.items()), columns=["date", "value"])
    returns_df["cumulative_returns"] = (1 + returns_df["value"]).cumprod() - 1
    return returns_df


def plot_cumulative_returns(
    returns_df,
    factor_model,
    factor_assets=None,
    long_only_returns=None,
    short_only_returns=None,
):
    """Helper to plot the cumulative returns and number of assets each period for a factor"""
    # Create the plot
    fig, ax1 = plt.subplots(figsize=(10, 6))

    if long_only_returns is not None and short_only_returns is not None:
        long_only_returns = long_only_returns.rename(
            columns={"cumulative_returns": "long_only_returns"}
        )
        short_only_returns = short_only_returns.rename(
            columns={"cumulative_returns": "short_only_returns"}
        )
        merged_df = returns_df.merge(long_only_returns, on="date", how="left").merge(
            short_only_returns, on="date", how="left"
        )
    else:
        merged_df = returns_df
    # Plot cumulative returns on primary axis with different colors
    ax1.plot(
        merged_df["date"],
        merged_df["cumulative_returns"],
        linewidth=1.5,
        color="tab:blue",
        label="Cumulative Returns",
    )

    if long_only_returns is not None:
        ax1.plot(
            merged_df["date"],
            merged_df["long_only_returns"],
            linewidth=1.5,
            color="tab:green",
            label="Long Only Returns",
        )

    if short_only_returns is not None:
        ax1.plot(
            merged_df["date"],
            merged_df["short_only_returns"],
            linewidth=1.5,
            color="tab:red",
            label="Short Only Returns",
        )

    ax1.set_xlabel("Date")
    ax1.set_ylabel("Cumulative Returns")

    ax1.grid(True, alpha=0.3)

    # Plot factor assets on secondary axis if provided
    if factor_assets is not None:
        if isinstance(factor_assets, dict):
            factor_assets = pd.Series(factor_assets)

        ax2 = ax1.twinx()
        color2 = "tab:orange"
        ax2.bar(
            factor_assets.index,
            factor_assets.values,
            alpha=0.3,
            color=color2,
            label="# Assets",
            width=5,
        )
        ax2.set_ylabel("Number of Assets", color=color2)
        ax2.tick_params(axis="y", labelcolor=color2)
        ax2.ticklabel_format(style="plain", axis="y")
        ax2.legend(loc="upper right")

    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.title(f"{factor_model.factor.upper()} Factor Performance")
    # reformat y axis ticks to percentage
    ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: "{:.0%}".format(x)))
    # add annotation for all elements within factor_model.results_dict
    annualized_return = factor_model.results_dict["annualized_return"]
    start_date = factor_model.results_dict["start_date"]
    end_date = factor_model.results_dict["end_date"]
    sharpe_ratio = factor_model.results_dict["sharpe_ratio"]
    sortino_ratio = factor_model.results_dict["sortino_ratio"]

    metrics_text = f"""
    Annualized Return: {annualized_return:>4.1%}    
    Sharpe Ratio: {sharpe_ratio:>4.2f}
    Sortino Ratio: {sortino_ratio:>4.2f}
    Start Date: {start_date:>4}
    End Date: {end_date:>4}
    """

    # Add text box in upper left corner
    props = dict(boxstyle="round,pad=0.3", facecolor="white", alpha=0.8)
    ax1.text(
        0.02,
        0.98,
        metrics_text,
        transform=ax1.transAxes,
        fontsize=9,
        verticalalignment="top",
        bbox=props,
    )

    plt.show()


def calculate_annualized_return(factor, returns_df):
    """Helper to calculate the annualized return for a factor"""
    dates = [pd.to_datetime(x) for x in factor.factor_returns.keys()]
    days = (dates[-1] - dates[0]).days
    years = days / 365
    cumulative_returns = returns_df["cumulative_returns"].iloc[-1]
    annualized_return = ((cumulative_returns + 1) ** (1 / years)) - 1
    print(f"""
        Factor Model: {factor.factor}
        Breakpoint: {factor.breakpoint}
        Min Assets: {factor.min_assets}
        Weighting Method: {factor.weighting_method}
        Annualized Return: {annualized_return}
        Cumulative Returns: {cumulative_returns}
        Years: {years}
    """)
    return annualized_return, cumulative_returns, years


def convert_to_log_returns(
    returns_dict: dict, weekly_rf_df: Optional[pd.DataFrame] = None
) -> dict:
    if weekly_rf_df is not None:
        returns_df = pd.DataFrame(list(returns_dict.items()), columns=["date", "value"])
        returns_df = returns_df.merge(weekly_rf_df, on="date", how="left").fillna(0)
        # net out risk free rate
        returns_df["value"] = returns_df["value"] - returns_df["rf_weekly"]
        returns_df = returns_df[["date", "value"]]
        returns_df.set_index("date", inplace=True)
        # convert to log returns
        returns_df["value"] = np.log(1 + (returns_df["value"]))
        # convert back to dict
        returns_df_dict = returns_df.to_dict()
        return returns_df_dict["value"]
    else:
        # return log returns in dict
        return {date: np.log(1 + ret) for date, ret in returns_dict.items()}


# ============================================================================
# Monthly Metrics Functions (ported from factor_models.ipynb)
# ============================================================================


def calculate_monthly_metrics(
    factor_model: FactorModel,
    returns_df: pd.DataFrame,
    rf_df: Optional[pd.DataFrame] = None,
) -> pd.DataFrame:
    """
    Calculate monthly performance metrics for a factor model.

    Args:
        factor_model: FactorModel instance with computed factor returns
        returns_df: DataFrame with returns data (used as fallback)
        rf_df: Optional DataFrame with risk-free rate data (column 'rf_weekly')

    Returns a DataFrame with:
    - Monthly Return (current month)
    - Yearly Return (current year)
    - Annualized Return
    - Volatility (annual)
    - Excess Return (annualized, over risk-free rate)
    - Sharpe Ratio
    - Sortino Ratio
    - Max Drawdown (Current Week)
    - Dominance (HHI)
    - Contribution to Return (Current Week)
    - Top Contributor (Week)
    - Average ADV (Week)
    - Average Market Cap
    """
    now = datetime.now()
    current_year = now.year
    current_month = now.month

    # Convert returns dict to DataFrame if needed
    if isinstance(factor_model.factor_returns, dict):
        returns_data = pd.DataFrame(
            list(factor_model.factor_returns.items()), columns=["date", "return"]
        )
        returns_data["date"] = pd.to_datetime(returns_data["date"])
        returns_data = returns_data.set_index("date")
    else:
        returns_data = returns_df.copy()

    # Get the returns column name (could be 'return', 'momentum_v2', etc.)
    returns_col = returns_data.columns[0] if len(returns_data.columns) > 0 else "return"

    # 1. Monthly Return (current month)
    current_month_returns = returns_data[
        (returns_data.index.year == current_year)
        & (returns_data.index.month == current_month)
    ]
    if len(current_month_returns) > 0:
        monthly_return = (1 + current_month_returns[returns_col]).prod() - 1
    else:
        monthly_return = np.nan

    # 2. Yearly Return (current year)
    current_year_returns = returns_data[returns_data.index.year == current_year]
    if len(current_year_returns) > 0:
        yearly_return = (1 + current_year_returns[returns_col]).prod() - 1
    else:
        yearly_return = np.nan

    # 3. Annualized Return (from results_dict if available, otherwise calculate)
    if "annualized_return" in factor_model.results_dict:
        annualized_return = factor_model.results_dict["annualized_return"]
    else:
        # Calculate if not available
        if len(returns_data) > 0:
            days = (returns_data.index[-1] - returns_data.index[0]).days
            years = days / 365.25
            cumulative_return = (1 + returns_data[returns_col]).prod() - 1
            annualized_return = (
                ((1 + cumulative_return) ** (1 / years)) - 1 if years > 0 else np.nan
            )
        else:
            annualized_return = np.nan

    # 4. Volatility (annual)
    if len(returns_data) > 0:
        # Weekly volatility, annualized
        weekly_vol = returns_data[returns_col].std()
        annualized_vol = weekly_vol * np.sqrt(52)
    else:
        annualized_vol = np.nan

    # 5. Excess Return (annualized, over risk-free rate)
    if rf_df is not None and len(returns_data) > 0:
        # Merge returns with risk-free rate on date
        returns_with_rf = returns_data.merge(
            rf_df[["rf_weekly"]], left_index=True, right_index=True, how="left"
        )
        returns_with_rf["rf_weekly"] = returns_with_rf["rf_weekly"].fillna(0)

        # Calculate excess returns (return - risk-free rate)
        returns_with_rf["excess_return"] = (
            returns_with_rf[returns_col] - returns_with_rf["rf_weekly"]
        )

        # Calculate annualized excess return
        if len(returns_with_rf) > 0:
            days = (returns_with_rf.index[-1] - returns_with_rf.index[0]).days
            years = days / 365.25
            cumulative_excess_return = (1 + returns_with_rf["excess_return"]).prod() - 1
            annualized_excess_return = (
                ((1 + cumulative_excess_return) ** (1 / years)) - 1
                if years > 0
                else np.nan
            )
        else:
            annualized_excess_return = np.nan
    else:
        annualized_excess_return = np.nan

    # 6. Sharpe Ratio
    if "sharpe_ratio" in factor_model.results_dict:
        sharpe_ratio = factor_model.results_dict["sharpe_ratio"]
    elif len(returns_data) > 0:
        mean_return = returns_data[returns_col].mean()
        std_return = returns_data[returns_col].std()
        if std_return > 0:
            sharpe_ratio = (mean_return / std_return) * np.sqrt(52)
        else:
            sharpe_ratio = np.nan
    else:
        sharpe_ratio = np.nan

    # 7. Sortino Ratio
    if "sortino_ratio" in factor_model.results_dict:
        sortino_ratio = factor_model.results_dict["sortino_ratio"]
    elif len(returns_data) > 0:
        downside_returns = returns_data[returns_data[returns_col] < 0][returns_col]
        if len(downside_returns) > 0:
            mean_return = returns_data[returns_col].mean()
            downside_std = downside_returns.std()
            if downside_std > 0:
                sortino_ratio = (mean_return / downside_std) * np.sqrt(52)
            else:
                sortino_ratio = np.nan
        else:
            sortino_ratio = np.nan
    else:
        sortino_ratio = np.nan

    # 8. Max Drawdown (Current Week)
    max_drawdown_current_week = np.nan
    if len(returns_data) > 0:
        cumulative = (1 + returns_data[returns_col]).cumprod()
        running_max = cumulative.expanding().max()
        drawdown = (cumulative - running_max) / running_max

        current_week_returns = returns_data[
            (returns_data.index.year == current_year)
            & (returns_data.index.month == current_month)
        ]

        if len(current_week_returns) > 0:
            current_week_drawdown = drawdown[current_week_returns.index]
            max_drawdown_current_week = current_week_drawdown.min()
        else:
            if len(drawdown) > 0:
                max_drawdown_current_week = drawdown.iloc[-1]

    # 9. HHI (Herfindahl-Hirschman Index) - Portfolio Concentration
    hhi_long = np.nan
    hhi_short = np.nan
    if len(factor_model.factor_assets) > 0:
        sorted_dates = sorted(factor_model.factor_assets.keys())
        latest_date = sorted_dates[-1]

        long_portfolio = factor_model.factor_assets[latest_date]["long_portfolio"]
        if len(long_portfolio) > 0:
            long_weights = [
                asset_data["weighting"] for asset_data in long_portfolio.values()
            ]
            hhi_long = sum(w**2 for w in long_weights)

        short_portfolio = factor_model.factor_assets[latest_date].get(
            "short_portfolio", {}
        )
        if len(short_portfolio) > 0:
            short_weights = [
                asset_data["weighting"] for asset_data in short_portfolio.values()
            ]
            hhi_short = sum(w**2 for w in short_weights)

    hhi = np.nan
    if not np.isnan(hhi_long) and not np.isnan(hhi_short):
        hhi = (hhi_long + hhi_short) / 2
    elif not np.isnan(hhi_long):
        hhi = hhi_long
    elif not np.isnan(hhi_short):
        hhi = hhi_short

    # 10. Contribution to Return & Top Contributor
    total_contribution = np.nan
    top_contributor = "N/A"
    if len(factor_model.factor_assets) > 0:
        sorted_dates = sorted(factor_model.factor_assets.keys())
        latest_date = sorted_dates[-1]

        long_portfolio = factor_model.factor_assets[latest_date]["long_portfolio"]
        short_portfolio = factor_model.factor_assets[latest_date].get(
            "short_portfolio", {}
        )

        long_contributions = {}
        for asset, asset_data in long_portfolio.items():
            weighting = asset_data["weighting"]
            price_pct_change = asset_data.get("price_pct_change", 0)
            contribution = weighting * price_pct_change
            long_contributions[asset] = contribution

        short_contributions = {}
        for asset, asset_data in short_portfolio.items():
            weighting = asset_data["weighting"]
            price_pct_change = asset_data.get("price_pct_change", 0)
            contribution = -weighting * price_pct_change
            short_contributions[asset] = contribution

        all_contributions = {**long_contributions, **short_contributions}

        if len(all_contributions) > 0:
            total_contribution = sum(all_contributions.values())
            top_contributor = max(
                all_contributions.items(), key=lambda x: abs(x[1])
            )[0]

    # 11. Average ADV (Average Daily Volume) for the Week
    avg_adv_week = np.nan
    if len(factor_model.factor_assets) > 0:
        sorted_dates = sorted(factor_model.factor_assets.keys())
        latest_date = sorted_dates[-1]

        latest_portfolio = list(
            factor_model.factor_assets[latest_date]["long_portfolio"].keys()
        ) + list(
            factor_model.factor_assets[latest_date].get("short_portfolio", {}).keys()
        )

        if "date" in factor_model.df.columns:
            latest_date_data = factor_model.df[factor_model.df["date"] == latest_date]
        else:
            latest_date_data = factor_model.df[factor_model.df.index == latest_date]

        portfolio_volumes = latest_date_data[
            latest_date_data["asset"].isin(latest_portfolio)
        ]["24h_volume"]

        if len(portfolio_volumes) > 0:
            daily_volumes = portfolio_volumes / 7
            avg_adv_week = daily_volumes.mean()

    # 12. Average Market Cap
    avg_market_cap = np.nan
    if len(factor_model.factor_assets) > 0:
        sorted_dates = sorted(factor_model.factor_assets.keys())
        latest_date = sorted_dates[-1]

        latest_portfolio = list(
            factor_model.factor_assets[latest_date]["long_portfolio"].keys()
        ) + list(
            factor_model.factor_assets[latest_date].get("short_portfolio", {}).keys()
        )

        if "date" in factor_model.df.columns:
            latest_date_data = factor_model.df[factor_model.df["date"] == latest_date]
        else:
            latest_date_data = factor_model.df[factor_model.df.index == latest_date]

        portfolio_mcs = latest_date_data[
            latest_date_data["asset"].isin(latest_portfolio)
        ]["mc_t_minus_1"]

        if len(portfolio_mcs) > 0:
            avg_market_cap = portfolio_mcs.mean()

    # Create results DataFrame
    metrics_df = pd.DataFrame(
        {
            "metric": [
                "Monthly Return (Current Month)",
                "Yearly Return (Current Year)",
                "Annualized Return",
                "Volatility (Annual)",
                "Excess Return (Annualized)",
                "Sharpe Ratio",
                "Sortino Ratio",
                "Max Drawdown (Current Week)",
                "Dominance (HHI)",
                "Contribution to Return (Current Week)",
                "Top Contributor (Week)",
                "Average ADV (Week)",
                "Average Market Cap",
            ],
            "value": [
                monthly_return,
                yearly_return,
                annualized_return,
                annualized_vol,
                annualized_excess_return,
                sharpe_ratio,
                sortino_ratio,
                max_drawdown_current_week,
                hhi,
                total_contribution,
                top_contributor,
                avg_adv_week,
                avg_market_cap,
            ],
            "value_formatted": [
                f"{monthly_return:.2%}" if not np.isnan(monthly_return) else "N/A",
                f"{yearly_return:.2%}" if not np.isnan(yearly_return) else "N/A",
                f"{annualized_return:.2%}" if not np.isnan(annualized_return) else "N/A",
                f"{annualized_vol:.2%}" if not np.isnan(annualized_vol) else "N/A",
                (
                    f"{annualized_excess_return:.2%}"
                    if not np.isnan(annualized_excess_return)
                    else "N/A"
                ),
                f"{sharpe_ratio:.2f}" if not np.isnan(sharpe_ratio) else "N/A",
                f"{sortino_ratio:.2f}" if not np.isnan(sortino_ratio) else "N/A",
                (
                    f"{max_drawdown_current_week:.2%}"
                    if not np.isnan(max_drawdown_current_week)
                    else "N/A"
                ),
                f"{hhi:.4f}" if not np.isnan(hhi) else "N/A",
                (
                    f"{total_contribution:.2%}"
                    if not np.isnan(total_contribution)
                    else "N/A"
                ),
                top_contributor,
                f"{avg_adv_week:,.0f}" if not np.isnan(avg_adv_week) else "N/A",
                f"${avg_market_cap:,.0f}" if not np.isnan(avg_market_cap) else "N/A",
            ],
            "as_of_date": [now.strftime("%Y-%m-%d")] * 13,
            "factor_name": [factor_model.factor] * 13,
        }
    )

    return metrics_df


def save_monthly_metrics(metrics_df: pd.DataFrame, output_dir: str = "factor_logs"):
    """
    Save monthly metrics to CSV for tracking over time.

    Args:
        metrics_df: DataFrame from calculate_monthly_metrics()
        output_dir: Directory to save the CSV file

    Returns:
        Path to the saved file
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    factor_name = metrics_df["factor_name"].iloc[0]
    filename = f"{factor_name}_monthly_metrics.csv"
    filepath = output_path / filename

    file_exists = filepath.exists()
    metrics_df.to_csv(filepath, mode="a", header=not file_exists, index=False)
    print(f"Metrics saved to {filepath}")
    return filepath


def monthly_returns(
    factor_model: FactorModel,
    *,
    year: Optional[int] = None,
    months: Optional[int] = 12,
) -> pd.Series:
    """
    Calculate monthly returns for a factor model.

    Args:
        factor_model: FactorModel instance with computed factor returns
        year: Optional year filter (only returns for this year)
        months: Number of months to include (default 12, from most recent date)

    Returns:
        Series with monthly returns indexed by period string (e.g., '2024-01')
    """
    r = pd.Series(factor_model.factor_returns).sort_index()
    r.index = pd.to_datetime(r.index)

    if year is not None:
        r = r.loc[r.index.year == year]

    if months is not None:
        if r.empty:
            return pd.Series(dtype=float)
        end = r.index.max()
        start = end - pd.DateOffset(months=months)
        r = r.loc[r.index >= start]

    m = r.groupby(pd.Grouper(freq="M")).apply(lambda x: (1 + x).prod() - 1)
    m.index = m.index.to_period("M").astype(str)
    return m


def plot_rolling_return_paths(
    returns_series: pd.Series,
    weeks: int = 52,
    step_size: int = 1,
    figsize: tuple = (10, 5),
):
    """
    Plot rolling cumulative return paths.

    Args:
        returns_series: Series of periodic returns with datetime index
        weeks: Number of weeks in each rolling window (default: 52)
        step_size: Step size between consecutive paths (default: 1)
            - step_size=1: every week (overlapping paths)
            - step_size=2: every 2 weeks
            - step_size=4: every 4 weeks
            - step_size=52: non-overlapping annual periods
        figsize: Figure size for plots
    """
    # Sort the series
    returns_series = returns_series.sort_index()

    # Calculate number of paths based on step_size
    num_paths = (len(returns_series) - weeks) // step_size + 1

    if num_paths <= 0:
        print(f"Not enough data points for {weeks}-week rolling paths")
        return

    # First chart: Individual colored paths
    plt.figure(figsize=figsize)

    colors = plt.cm.viridis(np.linspace(0, 1, num_paths))

    # Plot each path with step_size
    for idx, i in enumerate(range(0, len(returns_series) - weeks + 1, step_size)):
        window = returns_series.iloc[i : i + weeks]
        cumulative = (1 + window).cumprod() - 1
        weeks_axis = np.arange(len(cumulative))

        label_freq = max(1, num_paths // 10)
        plt.plot(
            weeks_axis,
            cumulative.values,
            alpha=0.4,
            linewidth=1.5,
            color=colors[idx],
            label=(
                f"Start: {window.index[0].strftime('%Y-%m-%d')}"
                if idx % label_freq == 0
                else ""
            ),
        )

    plt.axhline(y=0, color="red", linestyle="--", alpha=0.7, linewidth=2)
    plt.title(
        f'All {weeks}-Week Cumulative Return Paths (Step: {step_size} week{"s" if step_size > 1 else ""})',
        fontsize=16,
        fontweight="bold",
    )
    plt.xlabel("Weeks into Period", fontsize=12)
    plt.ylabel("Cumulative Compounded Return", fontsize=12)
    plt.grid(True, alpha=0.3)

    ax = plt.gca()
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda y, _: "{:.0%}".format(y)))
    plt.legend(loc="upper left", fontsize=8, framealpha=0.9)

    plt.tight_layout()
    plt.show()

    # Second chart: Paths with summary statistics
    plt.figure(figsize=figsize)

    all_paths = []
    for i in range(0, len(returns_series) - weeks + 1, step_size):
        window = returns_series.iloc[i : i + weeks]
        cumulative = (1 + window).cumprod() - 1
        all_paths.append(cumulative.values)

        weeks_axis = np.arange(len(cumulative))
        plt.plot(
            weeks_axis, cumulative.values, alpha=0.15, linewidth=1, color="steelblue"
        )

    all_paths_array = np.array(all_paths)
    mean_path = np.mean(all_paths_array, axis=0)
    median_path = np.median(all_paths_array, axis=0)
    min_path = np.min(all_paths_array, axis=0)
    max_path = np.max(all_paths_array, axis=0)
    percentile_25 = np.percentile(all_paths_array, 25, axis=0)
    percentile_75 = np.percentile(all_paths_array, 75, axis=0)

    weeks_axis = np.arange(weeks)
    plt.plot(
        weeks_axis, mean_path, linewidth=3, color="darkblue", label="Mean Path", alpha=0.9
    )
    plt.plot(
        weeks_axis,
        median_path,
        linewidth=3,
        color="green",
        label="Median Path",
        alpha=0.9,
    )
    plt.plot(
        weeks_axis,
        min_path,
        linewidth=2,
        color="red",
        label="Worst Path",
        linestyle="--",
        alpha=0.9,
    )
    plt.plot(
        weeks_axis,
        max_path,
        linewidth=2,
        color="darkgreen",
        label="Best Path",
        linestyle="--",
        alpha=0.9,
    )
    plt.fill_between(
        weeks_axis,
        percentile_25,
        percentile_75,
        alpha=0.2,
        color="gray",
        label="25th-75th Percentile",
    )

    plt.axhline(y=0, color="black", linestyle="-", alpha=0.5, linewidth=1)
    plt.title(
        f'{weeks}-Week Cumulative Return Paths with Statistics (Step: {step_size} week{"s" if step_size > 1 else ""})',
        fontsize=16,
        fontweight="bold",
    )
    plt.xlabel("Weeks into Period", fontsize=12)
    plt.ylabel("Cumulative Compounded Return", fontsize=12)
    plt.grid(True, alpha=0.3)
    plt.legend(loc="upper left", fontsize=11, framealpha=0.9)

    ax = plt.gca()
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda y, _: "{:.0%}".format(y)))

    plt.tight_layout()
    plt.show()

    # Print statistics
    print(
        f"\n{weeks}-Week Path Statistics (Step size: {step_size} week{'s' if step_size > 1 else ''}):"
    )
    print(f"Number of paths analyzed: {len(all_paths)}")
    print(f"Final returns (week {weeks}):")
    print(f"  Mean: {mean_path[-1]:.2%}")
    print(f"  Median: {median_path[-1]:.2%}")
    print(f"  Best: {max_path[-1]:.2%}")
    print(f"  Worst: {min_path[-1]:.2%}")
    print(f"  25th percentile: {percentile_25[-1]:.2%}")
    print(f"  75th percentile: {percentile_75[-1]:.2%}")


# ============================================================================
# Weighting & Transformation Helpers
# ============================================================================


def calculate_inverse_variance_weights(
    df: pd.DataFrame,
    returns_col: str = "price_pct_change_p1",
    group_col: str = "asset",
) -> pd.Series:
    """
    Calculate inverse variance weights for portfolio construction.

    Args:
        df: DataFrame with asset returns
        returns_col: Column name containing returns
        group_col: Column name for grouping (typically 'asset')

    Returns:
        Series with inverse variance values (add to df as new column)
    """
    variance = df.groupby(group_col)[returns_col].transform("var")
    inverse_variance = 1 / variance
    return inverse_variance.replace([np.inf, -np.inf], np.nan)


def calculate_weighted_return(
    df: pd.DataFrame,
    returns_col: str,
    weighting_method: str,
    weight_col: Optional[str] = None,
) -> float:
    """
    Calculate weighted average return for a portfolio.

    Args:
        df: DataFrame with portfolio assets
        returns_col: Column containing returns
        weighting_method: One of 'equal', 'market_cap', 'inverse_variance'
        weight_col: Column to use for weighting (required for market_cap/inverse_variance)

    Returns:
        Weighted average return
    """
    if weighting_method == "equal":
        return df[returns_col].mean()
    elif weighting_method == "market_cap":
        if weight_col is None:
            weight_col = "mc_t_minus_1"
        weights = df[weight_col].astype(float)
        numerator = (df[returns_col].astype(float) * weights).sum()
        denominator = weights.sum()
        return numerator / denominator if denominator != 0 else np.nan
    elif weighting_method == "inverse_variance":
        if weight_col is None:
            weight_col = "inverse_variance"
        weights = df[weight_col].astype(float)
        numerator = (df[returns_col].astype(float) * weights).sum()
        denominator = weights.sum()
        return numerator / denominator if denominator != 0 else np.nan
    else:
        raise ValueError(f"Unknown weighting method: {weighting_method}")


def mc_weighted_average(group: pd.DataFrame, value_col: str, mc_col: str = "mc_lag") -> float:
    """
    Calculate market-cap weighted average for a group.

    Args:
        group: DataFrame group
        value_col: Column containing values to average
        mc_col: Column containing market cap weights

    Returns:
        Market-cap weighted average
    """
    weights = group[mc_col].astype(float)
    numerator = (group[value_col].astype(float) * weights).sum()
    denominator = weights.sum()
    if denominator == 0:
        return float("nan")
    return numerator / denominator


# ============================================================================
# Volatility Adjustment Helpers (for Momentum V2)
# ============================================================================


def calculate_vol_ratio(
    df: pd.DataFrame,
    returns_col: str = "price_pct_change_p1",
    lookback_periods: int = 3,
    group_col: str = "asset",
) -> pd.Series:
    """
    Calculate volatility ratio (|rolling_mean| / rolling_std) for vol-adjusted momentum.

    Args:
        df: DataFrame with asset returns
        returns_col: Column name containing returns
        lookback_periods: Number of periods for rolling calculation
        group_col: Column name for grouping (typically 'asset')

    Returns:
        Series with volatility ratio values
    """
    rolling_mean = df.groupby(group_col)[returns_col].transform(
        lambda x: x.rolling(lookback_periods, min_periods=1).mean()
    )
    rolling_std = df.groupby(group_col)[returns_col].transform(
        lambda x: x.rolling(lookback_periods, min_periods=1).std()
    )

    vol_ratio = (rolling_mean.abs() / rolling_std).replace([np.inf, -np.inf], 0).fillna(0)
    return vol_ratio


def calculate_filtered_momentum(
    df: pd.DataFrame,
    momentum_col: str,
    vol_ratio_col: str = "vol_ratio",
) -> pd.Series:
    """
    Calculate filtered (vol-adjusted) momentum.

    Args:
        df: DataFrame with momentum and vol_ratio columns
        momentum_col: Column containing raw momentum values
        vol_ratio_col: Column containing volatility ratio

    Returns:
        Series with filtered momentum values (momentum * vol_ratio)
    """
    return df[momentum_col] * df[vol_ratio_col]


# ============================================================================
# Winsorization Helper
# ============================================================================


def winsorize_series(
    series: pd.Series,
    lower_percentile: float = 0.05,
    upper_percentile: float = 0.05,
) -> pd.Series:
    """
    Winsorize a series by capping extreme values at specified percentiles.

    Args:
        series: Pandas Series to winsorize
        lower_percentile: Lower tail percentile to cap (default 0.05 = 5%)
        upper_percentile: Upper tail percentile to cap (default 0.05 = 5%)

    Returns:
        Winsorized series

    Note:
        For scipy.stats.mstats.winsorize, you can use:
        from scipy.stats.mstats import winsorize
        winsorized = winsorize(series, limits=[lower_percentile, upper_percentile])
    """
    lower_bound = series.quantile(lower_percentile)
    upper_bound = series.quantile(1 - upper_percentile)
    return series.clip(lower=lower_bound, upper=upper_bound)


def calculate_growth_metrics(
    df: pd.DataFrame,
    lookback_periods: int = 2,
    metrics: Optional[list] = None,
) -> pd.DataFrame:
    """
    Calculate growth metrics (percentage changes) for fundamental data.

    Args:
        df: DataFrame grouped by asset with fundamental metrics
        lookback_periods: Number of periods for percentage change calculation
        metrics: List of metrics to calculate growth for
                 Default: ['fees', 'dau', 'revenue', 'active_revenue', 'passive_revenue']

    Returns:
        DataFrame with added _pct_change columns for each metric
    """
    if metrics is None:
        metrics = ["fees", "dau", "revenue", "active_revenue", "passive_revenue"]

    df = df.copy()
    for metric in metrics:
        if metric in df.columns:
            df[f"{metric}_pct_change"] = df.groupby("asset")[metric].pct_change(
                periods=lookback_periods
            )
    return df
