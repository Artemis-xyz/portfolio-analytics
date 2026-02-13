"""
FastAPI wrapper for Factor Models

Run with: uvicorn api:app --reload
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Lazy imports for heavy dependencies
_ApiData = None
_FactorModel = None
_Logger = None
_cumulative_returns = None


_fetch_merged_crypto_data = None


def _load_utils():
    """Lazy load utils module to handle optional dependencies"""
    global _ApiData, _FactorModel, _Logger, _cumulative_returns, _fetch_merged_crypto_data
    if _FactorModel is None:
        from utils import ApiData, FactorModel, Logger, cumulative_returns, fetch_merged_crypto_data
        _ApiData = ApiData
        _FactorModel = FactorModel
        _Logger = Logger
        _cumulative_returns = cumulative_returns
        _fetch_merged_crypto_data = fetch_merged_crypto_data
    return _ApiData, _FactorModel, _Logger, _cumulative_returns

# Initialize FastAPI app
app = FastAPI(
    title="Factor Models API",
    description="API for cryptocurrency factor model analysis",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://rctyagxwbequikcdgkec.supabase.co",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
FACTOR_LOGS_DIR = Path(__file__).parent / "factor_logs"
API_KEY = os.getenv("ARTEMIS_API_KEY")

# Available factors
AVAILABLE_FACTORS = ["smb", "market", "value", "momentum", "momentum_v2", "growth"]


# Pydantic Models
class FactorConfig(BaseModel):
    """Configuration for running a factor model"""

    factor: str = Field(..., description="Factor name (smb, market, value, momentum, growth)")
    breakpoint: float = Field(0.5, ge=0.1, le=0.5, description="Percentile breakpoint for portfolio splits")
    min_assets: int = Field(30, ge=5, description="Minimum assets per period")
    weighting_method: str = Field("equal", description="Weighting method: equal, market_cap, inverse_variance")
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date (YYYY-MM-DD)")
    market_cap_threshold: Optional[int] = Field(100_000_000, description="Minimum market cap filter")
    liquidity_threshold: Optional[int] = Field(35_000_000, description="Minimum 24h volume filter")
    min_lifetime_days: Optional[int] = Field(30, description="Minimum asset lifetime in days")


class FactorPerformance(BaseModel):
    """Factor performance metrics"""

    run_id: str
    factor: str
    breakpoint: Optional[float]
    min_assets: Optional[int]
    weighting_method: Optional[str]
    cumulative_returns: Optional[float]
    annualized_return: Optional[float]
    years: Optional[float]
    sharpe_ratio: Optional[float]
    sortino_ratio: Optional[float]
    long_only_returns: Optional[float]
    short_only_returns: Optional[float]
    start_date: Optional[str]
    end_date: Optional[str]


class FactorReturns(BaseModel):
    """Factor returns time series"""

    factor: str
    dates: List[str]
    returns: List[float]
    cumulative_returns: List[float]


class PortfolioComposition(BaseModel):
    """Portfolio composition for a given date"""

    date: str
    long_portfolio: Dict[str, dict]
    short_portfolio: Dict[str, dict]


# Helper functions
def load_factor_logs(factor: str) -> pd.DataFrame:
    """Load factor logs from CSV, handling evolving column formats"""
    file_path = FACTOR_LOGS_DIR / f"{factor}.csv"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"No logs found for factor: {factor}")

    # Read raw lines to handle inconsistent column counts
    with open(file_path, "r") as f:
        lines = [line.strip() for line in f.readlines() if line.strip()]

    if len(lines) < 2:
        return pd.DataFrame()

    # Get header columns
    header = lines[0].split(",")
    num_header_cols = len(header)

    # Parse data rows, padding or truncating to match header
    records = []
    for line in lines[1:]:
        values = line.split(",")
        # Pad with None or truncate to match header length
        if len(values) < num_header_cols:
            values.extend([None] * (num_header_cols - len(values)))
        elif len(values) > num_header_cols:
            # Extra columns might be sharpe_ratio, sortino_ratio, start_date, end_date
            extra_cols = ["sharpe_ratio", "sortino_ratio", "start_date", "end_date"]
            for i, col in enumerate(extra_cols):
                if col not in header and num_header_cols + i < len(values):
                    header.append(col)
            values = values[: len(header)]
        records.append(dict(zip(header, values)))

    df = pd.DataFrame(records)

    # Convert numeric columns
    numeric_cols = [
        "breakpoint", "min_assets", "cumulative_returns", "annualized_return",
        "years", "long_only_returns", "short_only_returns", "sharpe_ratio", "sortino_ratio"
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    return df


def get_api_data():
    """Get ApiData instance"""
    if not API_KEY:
        raise HTTPException(
            status_code=500,
            detail="ARTEMIS_API_KEY environment variable not set",
        )
    ApiData, _, _, _ = _load_utils()
    return ApiData(API_KEY)


# Endpoints
@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "name": "Factor Models API",
        "version": "1.0.0",
        "available_factors": AVAILABLE_FACTORS,
        "endpoints": {
            "/factors": "List all available factors",
            "/factors/{factor}/logs": "Get historical performance logs for a factor",
            "/factors/{factor}/latest": "Get latest performance for a factor",
            "/factors/compare": "Compare performance across all factors",
            "/compute": "Compute a new factor model (POST)",
        },
    }


@app.get("/factors")
async def list_factors():
    """List all available factors with descriptions"""
    return {
        "factors": [
            {
                "name": "smb",
                "description": "Small Minus Big - Size factor based on market capitalization",
                "signal": "Market cap (long small, short large)",
            },
            {
                "name": "market",
                "description": "Market factor - Top 10 assets by market cap",
                "signal": "Market cap weighted top assets",
            },
            {
                "name": "value",
                "description": "Value factor based on MC-to-fees ratio",
                "signal": "MC/Fees ratio (long high, short low)",
            },
            {
                "name": "momentum",
                "description": "Momentum factor - Simple trend following",
                "signal": "Price momentum over lookback period",
            },
            {
                "name": "momentum_v2",
                "description": "Momentum V2 - Volatility-adjusted momentum",
                "signal": "Momentum * (|mean_return| / std)",
            },
            {
                "name": "growth",
                "description": "Growth factor - Composite of fundamental metrics",
                "signal": "Fees, DAU, revenue growth rates",
            },
        ]
    }


@app.get("/factors/{factor}/logs", response_model=List[FactorPerformance])
async def get_factor_logs(
    factor: str,
    limit: int = Query(10, ge=1, le=100, description="Number of recent runs to return"),
):
    """Get historical performance logs for a factor"""
    if factor not in AVAILABLE_FACTORS:
        raise HTTPException(status_code=404, detail=f"Factor '{factor}' not found")

    df = load_factor_logs(factor)
    df = df.tail(limit)

    # Handle NaN values
    df = df.replace({np.nan: None})

    results = []
    for _, row in df.iterrows():
        results.append(
            FactorPerformance(
                run_id=str(row.get("run_id", "")),
                factor=str(row.get("factor", factor)),
                breakpoint=row.get("breakpoint"),
                min_assets=row.get("min_assets"),
                weighting_method=row.get("weighting_method"),
                cumulative_returns=row.get("cumulative_returns"),
                annualized_return=row.get("annualized_return"),
                years=row.get("years"),
                sharpe_ratio=row.get("sharpe_ratio"),
                sortino_ratio=row.get("sortino_ratio"),
                long_only_returns=row.get("long_only_returns"),
                short_only_returns=row.get("short_only_returns"),
                start_date=str(row.get("start_date")) if pd.notna(row.get("start_date")) else None,
                end_date=str(row.get("end_date")) if pd.notna(row.get("end_date")) else None,
            )
        )
    return results


@app.get("/factors/{factor}/latest", response_model=FactorPerformance)
async def get_factor_latest(factor: str):
    """Get the latest performance metrics for a factor"""
    if factor not in AVAILABLE_FACTORS:
        raise HTTPException(status_code=404, detail=f"Factor '{factor}' not found")

    df = load_factor_logs(factor)
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No logs found for factor: {factor}")

    row = df.iloc[-1].replace({np.nan: None})

    return FactorPerformance(
        run_id=str(row.get("run_id", "")),
        factor=str(row.get("factor", factor)),
        breakpoint=row.get("breakpoint"),
        min_assets=row.get("min_assets"),
        weighting_method=row.get("weighting_method"),
        cumulative_returns=row.get("cumulative_returns"),
        annualized_return=row.get("annualized_return"),
        years=row.get("years"),
        sharpe_ratio=row.get("sharpe_ratio"),
        sortino_ratio=row.get("sortino_ratio"),
        long_only_returns=row.get("long_only_returns"),
        short_only_returns=row.get("short_only_returns"),
        start_date=str(row.get("start_date")) if pd.notna(row.get("start_date")) else None,
        end_date=str(row.get("end_date")) if pd.notna(row.get("end_date")) else None,
    )


@app.get("/factors/compare")
async def compare_factors():
    """Compare latest performance across all factors"""
    comparison = []

    for factor in AVAILABLE_FACTORS:
        try:
            df = load_factor_logs(factor)
            if not df.empty:
                row = df.iloc[-1]
                comparison.append(
                    {
                        "factor": factor,
                        "annualized_return": row.get("annualized_return"),
                        "cumulative_returns": row.get("cumulative_returns"),
                        "sharpe_ratio": row.get("sharpe_ratio"),
                        "sortino_ratio": row.get("sortino_ratio"),
                        "years": row.get("years"),
                    }
                )
        except Exception:
            # Skip factors that fail to load (missing files, parse errors, etc.)
            continue

    # Sort by annualized return
    comparison = sorted(
        comparison,
        key=lambda x: x.get("annualized_return") or 0,
        reverse=True,
    )

    return {"comparison": comparison}


@app.get("/factors/time-series")
async def get_factors_time_series(
    factors: str = Query(default=",".join(AVAILABLE_FACTORS), description="Comma-separated list of factors"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    normalize_to_100: bool = Query(default=True),
) -> Dict[str, FactorReturns]:
    """
    Get time series data for multiple factors.

    Returns full cumulative return time series for requested factors,
    optionally normalized to 100 at start date.
    """
    result = {}
    factors_list = [f.strip() for f in factors.split(",") if f.strip()]

    for factor in factors_list:
        if factor not in AVAILABLE_FACTORS:
            continue

        try:
            # Load factor logs to get latest run info
            df = load_factor_logs(factor)
            if df.empty:
                continue

            latest_run = df.iloc[-1]
            run_id = latest_run.get("run_id")

            # Try to load time series from stored CSV file
            time_series_file = FACTOR_LOGS_DIR / f"{factor}_{run_id}_returns.csv"

            if not time_series_file.exists():
                # Skip if no time series data available
                print(f"No time series file found for {factor}: {time_series_file}")
                continue

            # Load time series data
            ts_df = pd.read_csv(time_series_file)

            # Filter by date range if provided
            if start_date:
                ts_df = ts_df[ts_df["date"] >= start_date]
            if end_date:
                ts_df = ts_df[ts_df["date"] <= end_date]

            if ts_df.empty:
                continue

            dates = ts_df["date"].tolist()
            returns = ts_df["return"].tolist()
            cumulative_returns_list = ts_df["cumulative_return"].tolist()

            # Normalize to 100 at start if requested
            if normalize_to_100 and len(cumulative_returns_list) > 0:
                # Convert cumulative returns (0.5 = 50% gain) to normalized values (100 baseline)
                cumulative_returns_list = [((val + 1) * 100) for val in cumulative_returns_list]

            result[factor] = FactorReturns(
                factor=factor,
                dates=dates,
                returns=returns,
                cumulative_returns=cumulative_returns_list
            )

        except Exception as e:
            print(f"Error loading time series for {factor}: {e}")
            continue

    return result


@app.post("/compute/smb")
async def compute_smb_factor(config: FactorConfig):
    """
    Compute SMB (Small Minus Big) factor model.

    This endpoint fetches data from Artemis API and computes the size factor.
    """
    # Validate factor name matches endpoint
    if config.factor not in ("smb", "SMB"):
        raise HTTPException(
            status_code=400,
            detail=f"Factor name '{config.factor}' does not match endpoint. Expected 'smb'.",
        )

    ApiData, FactorModel, Logger, cumulative_returns = _load_utils()

    try:
        df = _fetch_merged_crypto_data(
            start_date=config.start_date,
            end_date=config.end_date,
            artemis_metrics=["mc"],
            api_key=API_KEY,
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch merged crypto data: {str(e)}",
        )

    # Initialize factor model
    factor_model = FactorModel(
        df=df.reset_index(),
        factor="smb",
        breakpoint=config.breakpoint,
        min_assets=config.min_assets,
        weighting_method=config.weighting_method,
    )

    # Resample to weekly
    factor_model.resample("W", {"price": "last", "mc": "last", "24h_volume": "sum"})

    # Calculate metrics
    factor_model.calculate_price_pct_change(periods=1)
    factor_model.get_t_minus_1_metrics(["mc", "24h_volume"])

    # Apply filters
    if config.market_cap_threshold:
        factor_model.market_cap_threshold(config.market_cap_threshold)
    if config.liquidity_threshold:
        factor_model.liquidity_threshold(config.liquidity_threshold)
    if config.min_lifetime_days:
        factor_model.minimum_lifetime(config.min_lifetime_days)

    # Compute factor returns (simplified - actual logic is more complex in notebooks)
    dates = factor_model.df["date"].unique()
    for date in dates:
        period_data = factor_model.df[factor_model.df["date"] == date].copy()
        if len(period_data) < config.min_assets:
            continue

        # Sort by market cap
        period_data = period_data.sort_values("mc_t_minus_1")
        n = len(period_data)
        cutoff = int(n * config.breakpoint)

        # Long small, short big
        long_portfolio = period_data.head(cutoff)
        short_portfolio = period_data.tail(cutoff)

        if len(long_portfolio) == 0 or len(short_portfolio) == 0:
            continue

        long_return = long_portfolio["price_pct_change_p1"].mean()
        short_return = short_portfolio["price_pct_change_p1"].mean()

        factor_model.factor_returns[date] = long_return - short_return
        factor_model.long_portfolio_returns[date] = long_return
        factor_model.short_portfolio_returns[date] = short_return

    if not factor_model.factor_returns:
        raise HTTPException(status_code=400, detail="No factor returns computed - check data availability")

    # Calculate performance metrics
    returns_df = cumulative_returns(factor_model.factor_returns)
    total_cumulative = returns_df["cumulative_returns"].iloc[-1] if not returns_df.empty else 0

    dates_list = list(factor_model.factor_returns.keys())
    if len(dates_list) >= 2:
        days = (pd.to_datetime(dates_list[-1]) - pd.to_datetime(dates_list[0])).days
        if days > 0:
            years = days / 365
            annualized = ((total_cumulative + 1) ** (1 / years)) - 1
        else:
            years = 0
            annualized = 0
    else:
        years = 0
        annualized = 0

    # Calculate Sharpe ratio (simplified)
    returns_series = pd.Series(list(factor_model.factor_returns.values()))
    sharpe = (returns_series.mean() / returns_series.std()) * np.sqrt(52) if returns_series.std() > 0 else 0

    # Calculate Sortino ratio (downside deviation)
    downside_returns = returns_series[returns_series < 0]
    if len(downside_returns) > 0:
        downside_std = downside_returns.std()
        sortino = (returns_series.mean() / downside_std) * np.sqrt(52) if downside_std > 0 else None
    else:
        sortino = None

    # Calculate long-only and short-only cumulative returns
    long_returns_df = cumulative_returns(factor_model.long_portfolio_returns)
    short_returns_df = cumulative_returns(factor_model.short_portfolio_returns)
    long_only_cumulative = long_returns_df["cumulative_returns"].iloc[-1] if not long_returns_df.empty else 0
    short_only_cumulative = short_returns_df["cumulative_returns"].iloc[-1] if not short_returns_df.empty else 0

    result = {
        "factor": "smb",
        "config": config.model_dump(),
        "performance": {
            "cumulative_returns": float(total_cumulative),
            "annualized_return": float(annualized),
            "sharpe_ratio": float(sharpe),
            "sortino_ratio": float(sortino) if sortino is not None else None,
            "years": float(years),
            "num_periods": len(factor_model.factor_returns),
            "long_only_returns": float(long_only_cumulative),
            "short_only_returns": float(short_only_cumulative),
        },
        "returns": {
            str(k): float(v) for k, v in list(factor_model.factor_returns.items())[-10:]
        },
    }

    # Log results
    logger = Logger(FACTOR_LOGS_DIR, factor_model)
    factor_model.results_dict = {
        "cumulative_returns": total_cumulative,
        "annualized_return": annualized,
        "sharpe_ratio": sharpe,
        "sortino_ratio": sortino,
        "years": years,
        "long_only_returns": long_only_cumulative,
        "short_only_returns": short_only_cumulative,
        "start_date": str(dates_list[0]) if dates_list else None,
        "end_date": str(dates_list[-1]) if dates_list else None,
    }
    logger.log_results(factor_model.results_dict)

    # Save full time series to CSV
    returns_df_ts = cumulative_returns(factor_model.factor_returns)
    returns_df_ts = returns_df_ts.rename(columns={"value": "return", "cumulative_returns": "cumulative_return"})
    returns_df_ts["date"] = returns_df_ts["date"].astype(str)
    time_series_file = FACTOR_LOGS_DIR / f"{config.factor}_{logger.run_id}_returns.csv"
    returns_df_ts.to_csv(time_series_file, index=False)
    print(f"Saved time series to {time_series_file}")

    return result


@app.post("/compute/momentum")
async def compute_momentum_factor(
    config: FactorConfig,
    lookback_periods: int = Query(3, ge=1, le=12, description="Lookback periods for momentum calculation"),
):
    """
    Compute Momentum factor model with volatility adjustment.

    Uses vol-adjusted momentum: raw_momentum * (|mean_return| / std)
    """
    # Validate factor name matches endpoint
    if config.factor not in ("momentum", "MOMENTUM"):
        raise HTTPException(
            status_code=400,
            detail=f"Factor name '{config.factor}' does not match endpoint. Expected 'momentum'.",
        )

    ApiData, FactorModel, Logger, cumulative_returns = _load_utils()

    try:
        df = _fetch_merged_crypto_data(
            start_date=config.start_date,
            end_date=config.end_date,
            artemis_metrics=["mc"],
            api_key=API_KEY,
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch merged crypto data: {str(e)}",
        )

    # Initialize factor model
    factor_model = FactorModel(
        df=df.reset_index(),
        factor="momentum",
        breakpoint=config.breakpoint,
        min_assets=config.min_assets,
        weighting_method=config.weighting_method,
    )

    # Resample to weekly
    factor_model.resample("W", {"price": "last", "mc": "last", "24h_volume": "sum"})

    # Calculate price changes and momentum metrics
    factor_model.calculate_price_pct_change(periods=1)
    factor_model.calculate_price_pct_change(periods=lookback_periods)

    # Calculate rolling volatility metrics
    factor_model.df["rolling_mean"] = factor_model.df.groupby("asset")[
        "price_pct_change_p1"
    ].transform(lambda x: x.rolling(lookback_periods, min_periods=1).mean())

    factor_model.df["rolling_std"] = factor_model.df.groupby("asset")[
        "price_pct_change_p1"
    ].transform(lambda x: x.rolling(lookback_periods, min_periods=1).std())

    # Vol ratio (essentially rolling Sharpe)
    factor_model.df["vol_ratio"] = (
        factor_model.df["rolling_mean"].abs() / factor_model.df["rolling_std"]
    ).replace([np.inf, -np.inf], 0).fillna(0)

    # Filtered momentum
    factor_model.df["filtered_momentum"] = (
        factor_model.df[f"price_pct_change_p{lookback_periods}"] * factor_model.df["vol_ratio"]
    )

    factor_model.get_t_minus_1_metrics(["mc", "24h_volume", "filtered_momentum"])

    # Apply filters
    if config.market_cap_threshold:
        factor_model.market_cap_threshold(config.market_cap_threshold)
    if config.liquidity_threshold:
        factor_model.liquidity_threshold(config.liquidity_threshold)
    if config.min_lifetime_days:
        factor_model.minimum_lifetime(config.min_lifetime_days)

    # Compute factor returns
    dates = factor_model.df["date"].unique()
    for date in dates:
        period_data = factor_model.df[factor_model.df["date"] == date].copy()
        period_data = period_data.dropna(subset=["filtered_momentum_t_minus_1", "price_pct_change_p1"])

        if len(period_data) < config.min_assets:
            continue

        # Sort by filtered momentum
        period_data = period_data.sort_values("filtered_momentum_t_minus_1", ascending=False)
        n = len(period_data)
        cutoff = int(n * config.breakpoint)

        # Long high momentum, short low momentum
        long_portfolio = period_data.head(cutoff)
        short_portfolio = period_data.tail(cutoff)

        if len(long_portfolio) == 0 or len(short_portfolio) == 0:
            continue

        long_return = long_portfolio["price_pct_change_p1"].mean()
        short_return = short_portfolio["price_pct_change_p1"].mean()

        factor_model.factor_returns[date] = long_return - short_return
        factor_model.long_portfolio_returns[date] = long_return
        factor_model.short_portfolio_returns[date] = short_return

    if not factor_model.factor_returns:
        raise HTTPException(status_code=400, detail="No factor returns computed - check data availability")

    # Calculate performance metrics
    returns_df = cumulative_returns(factor_model.factor_returns)
    total_cumulative = returns_df["cumulative_returns"].iloc[-1] if not returns_df.empty else 0

    dates_list = list(factor_model.factor_returns.keys())
    if len(dates_list) >= 2:
        days = (pd.to_datetime(dates_list[-1]) - pd.to_datetime(dates_list[0])).days
        if days > 0:
            years = days / 365
            annualized = ((total_cumulative + 1) ** (1 / years)) - 1
        else:
            years = 0
            annualized = 0
    else:
        years = 0
        annualized = 0

    returns_series = pd.Series(list(factor_model.factor_returns.values()))
    sharpe = (returns_series.mean() / returns_series.std()) * np.sqrt(52) if returns_series.std() > 0 else 0

    # Calculate Sortino (downside deviation) - return None if no downside returns
    downside_returns = returns_series[returns_series < 0]
    if len(downside_returns) > 0:
        downside_std = downside_returns.std()
        sortino = (returns_series.mean() / downside_std) * np.sqrt(52) if downside_std > 0 else None
    else:
        sortino = None

    result = {
        "factor": "momentum",
        "config": {**config.model_dump(), "lookback_periods": lookback_periods},
        "performance": {
            "cumulative_returns": float(total_cumulative),
            "annualized_return": float(annualized),
            "sharpe_ratio": float(sharpe),
            "sortino_ratio": float(sortino) if sortino is not None else None,
            "years": float(years),
            "num_periods": len(factor_model.factor_returns),
        },
        "returns": {
            str(k): float(v) for k, v in list(factor_model.factor_returns.items())[-10:]
        },
    }

    # Log results
    logger = Logger(FACTOR_LOGS_DIR, factor_model)
    factor_model.results_dict = {
        "cumulative_returns": total_cumulative,
        "annualized_return": annualized,
        "sharpe_ratio": sharpe,
        "sortino_ratio": sortino,
        "years": years,
        "trailing_momentum_lookback_periods": lookback_periods,
        "start_date": str(dates_list[0]) if dates_list else None,
        "end_date": str(dates_list[-1]) if dates_list else None,
    }
    logger.log_results(factor_model.results_dict)

    # Save full time series to CSV
    returns_df_ts = cumulative_returns(factor_model.factor_returns)
    returns_df_ts = returns_df_ts.rename(columns={"value": "return", "cumulative_returns": "cumulative_return"})
    returns_df_ts["date"] = returns_df_ts["date"].astype(str)
    time_series_file = FACTOR_LOGS_DIR / f"{config.factor}_{logger.run_id}_returns.csv"
    returns_df_ts.to_csv(time_series_file, index=False)
    print(f"Saved time series to {time_series_file}")

    return result


@app.post("/compute/equity-factors")
async def compute_equity_factors(
    tickers: list[str],
    start_date: str,
    end_date: str,
):
    """
    Compute factor analysis for equity portfolio.

    This endpoint is an MVP implementation that uses the existing factor comparison data.
    For a full implementation, it would:
    1. Fetch equity data for the provided tickers using yfinance
    2. Compute Fama-French style factors (SMB, HML, momentum)
    3. Calculate factor exposures for the portfolio
    4. Return performance metrics

    For now, it returns the same factor comparison data as crypto but could be enhanced
    to use equity-specific data sources and factor models.
    """
    ApiData, FactorModel, Logger, cumulative_returns = _load_utils()

    try:
        # For MVP, validate inputs
        if not tickers or len(tickers) < 5:
            return {
                "error": "Minimum 5 equity tickers required for factor analysis",
                "tickers_provided": len(tickers) if tickers else 0
            }

        # Initialize factor model for equity
        factor_model = FactorModel(
            df=pd.DataFrame(),  # Empty for now
            factor="equity_composite",
            breakpoint=0.5,
            min_assets=5,
            weighting_method="equal",
        )

        # Compute equity factors (MVP implementation)
        result = factor_model.compute_equity_factors(tickers, start_date, end_date)

        # For MVP, return existing factor comparison data
        # In production, this would return equity-specific factor exposures
        comparison_data = []
        for factor in AVAILABLE_FACTORS:
            try:
                df = load_factor_logs(factor)
                if not df.empty:
                    row = df.iloc[-1]
                    comparison_data.append({
                        "factor": factor,
                        "annualized_return": row.get("annualized_return"),
                        "sharpe_ratio": row.get("sharpe_ratio"),
                        "sortino_ratio": row.get("sortino_ratio"),
                        "cumulative_returns": row.get("cumulative_returns"),
                    })
            except Exception:
                continue

        return {
            "equity_analysis": result,
            "factors": comparison_data,
            "tickers": tickers,
            "note": "MVP implementation using existing factor comparison data. Full equity-specific factors coming in v2."
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error computing equity factors: {str(e)}"
        )


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "api_key_configured": bool(API_KEY),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
