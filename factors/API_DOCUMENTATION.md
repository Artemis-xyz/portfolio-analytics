# Factor Models API Documentation

A FastAPI-based REST API for cryptocurrency factor model analysis. This API provides endpoints to retrieve historical factor performance, compare factors, and compute new factor models using the Artemis data platform.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Configuration](#configuration)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [General Endpoints](#general-endpoints)
  - [Factor Information](#factor-information)
  - [Factor Performance](#factor-performance)
  - [Compute Endpoints](#compute-endpoints)
- [Data Models](#data-models)
- [Factor Descriptions](#factor-descriptions)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Overview

The Factor Models API exposes cryptocurrency factor models that analyze risk premia across digital assets. The API supports:

- **6 Factor Models**: SMB (size), Market, Value, Momentum, Momentum V2, and Growth
- **Historical Performance Logs**: Access backtest results with Sharpe/Sortino ratios
- **Factor Comparison**: Compare all factors side-by-side
- **Live Computation**: Run factor models with custom parameters (requires Artemis API key)

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   FastAPI App   │────▶│   FactorModel   │────▶│   Artemis API   │
│     (api.py)    │     │   (utils.py)    │     │  (Data Source)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  factor_logs/   │
│   (CSV files)   │
└─────────────────┘
```

---

## Installation

### Prerequisites

- Python 3.10+
- pip or conda package manager

### Install Dependencies

```bash
cd scripts/factors
pip install -r requirements.txt
```

### Required Packages

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | >=0.109.0 | Web framework |
| uvicorn | >=0.27.0 | ASGI server |
| pydantic | >=2.0.0 | Data validation |
| pandas | >=2.0.0 | Data manipulation |
| numpy | >=1.24.0 | Numerical operations |
| python-dotenv | >=1.0.0 | Environment variables |

### Additional Dependencies for Compute Endpoints

The `/compute` endpoints require additional packages from the existing `utils.py`:

```bash
pip install artemis snowflake-connector-python statsmodels matplotlib
```

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ARTEMIS_API_KEY` | For `/compute` endpoints | API key for Artemis data platform |
| `SYSTEM_SNOWFLAKE_USER` | For beta calculations | Snowflake username |
| `SNOWFLAKE_ACCOUNT` | For beta calculations | Snowflake account identifier |

### Setting Up Environment

Create a `.env.local` file in the project root (three directories up from `scripts/factors`):

```bash
ARTEMIS_API_KEY=your_api_key_here
SYSTEM_SNOWFLAKE_USER=your_snowflake_user
SNOWFLAKE_ACCOUNT=your_snowflake_account
```

---

## Quick Start

### Start the Server

```bash
# Option 1: Using uvicorn directly
uvicorn api:app --reload --port 8000

# Option 2: Run the script
python api.py
```

### Access the API

- **API Base URL**: `http://localhost:8000`
- **Interactive Docs (Swagger)**: `http://localhost:8000/docs`
- **Alternative Docs (ReDoc)**: `http://localhost:8000/redoc`
- **OpenAPI Schema**: `http://localhost:8000/openapi.json`

### Quick Test

```bash
# Health check
curl http://localhost:8000/health

# List all factors
curl http://localhost:8000/factors

# Get momentum factor performance
curl http://localhost:8000/factors/momentum_v2/latest
```

---

## API Reference

### General Endpoints

#### `GET /`

Returns API information and available endpoints.

**Response**

```json
{
  "name": "Factor Models API",
  "version": "1.0.0",
  "available_factors": ["smb", "market", "value", "momentum", "momentum_v2", "growth"],
  "endpoints": {
    "/factors": "List all available factors",
    "/factors/{factor}/logs": "Get historical performance logs for a factor",
    "/factors/{factor}/latest": "Get latest performance for a factor",
    "/factors/compare": "Compare performance across all factors",
    "/compute": "Compute a new factor model (POST)"
  }
}
```

---

#### `GET /health`

Health check endpoint for monitoring and load balancers.

**Response**

```json
{
  "status": "healthy",
  "timestamp": "2025-01-23T10:30:00.000000",
  "api_key_configured": true
}
```

---

### Factor Information

#### `GET /factors`

List all available factors with descriptions and signal definitions.

**Response**

```json
{
  "factors": [
    {
      "name": "smb",
      "description": "Small Minus Big - Size factor based on market capitalization",
      "signal": "Market cap (long small, short large)"
    },
    {
      "name": "market",
      "description": "Market factor - Top 10 assets by market cap",
      "signal": "Market cap weighted top assets"
    },
    {
      "name": "value",
      "description": "Value factor based on MC-to-fees ratio",
      "signal": "MC/Fees ratio (long high, short low)"
    },
    {
      "name": "momentum",
      "description": "Momentum factor - Simple trend following",
      "signal": "Price momentum over lookback period"
    },
    {
      "name": "momentum_v2",
      "description": "Momentum V2 - Volatility-adjusted momentum",
      "signal": "Momentum * (|mean_return| / std)"
    },
    {
      "name": "growth",
      "description": "Growth factor - Composite of fundamental metrics",
      "signal": "Fees, DAU, revenue growth rates"
    }
  ]
}
```

---

### Factor Performance

#### `GET /factors/{factor}/logs`

Get historical performance logs for a specific factor.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `factor` | string | Factor name: `smb`, `market`, `value`, `momentum`, `momentum_v2`, `growth` |

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 10 | Number of recent runs to return (1-100) |

**Response**

```json
[
  {
    "run_id": "20251013_145014",
    "factor": "momentum_v2",
    "breakpoint": 0.25,
    "min_assets": 30,
    "weighting_method": "equal",
    "cumulative_returns": 12.17,
    "annualized_return": 0.747,
    "years": 4.62,
    "sharpe_ratio": 1.41,
    "sortino_ratio": 2.98,
    "long_only_returns": 7.96,
    "short_only_returns": -0.55,
    "start_date": "2021-03-07",
    "end_date": "2025-10-12"
  }
]
```

**Example**

```bash
# Get last 5 momentum runs
curl "http://localhost:8000/factors/momentum_v2/logs?limit=5"
```

---

#### `GET /factors/{factor}/latest`

Get the most recent performance metrics for a factor.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `factor` | string | Factor name |

**Response**

```json
{
  "run_id": "20251015_101742",
  "factor": "smb",
  "breakpoint": 0.5,
  "min_assets": 40,
  "weighting_method": "equal",
  "cumulative_returns": 7.23,
  "annualized_return": 0.536,
  "years": 4.91,
  "sharpe_ratio": 1.45,
  "sortino_ratio": 3.30,
  "long_only_returns": 15.15,
  "short_only_returns": 1.75,
  "start_date": "2020-11-22",
  "end_date": "2025-10-12"
}
```

**Example**

```bash
curl http://localhost:8000/factors/smb/latest
```

---

#### `GET /factors/compare`

Compare latest performance across all factors, sorted by annualized return.

**Response**

```json
{
  "comparison": [
    {
      "factor": "momentum_v2",
      "annualized_return": 0.747,
      "cumulative_returns": 12.17,
      "sharpe_ratio": 1.41,
      "sortino_ratio": 2.98,
      "years": 4.62
    },
    {
      "factor": "smb",
      "annualized_return": 0.536,
      "cumulative_returns": 7.23,
      "sharpe_ratio": 1.45,
      "sortino_ratio": 3.30,
      "years": 4.91
    },
    {
      "factor": "market",
      "annualized_return": 0.420,
      "cumulative_returns": null,
      "sharpe_ratio": 0.82,
      "sortino_ratio": null,
      "years": null
    },
    {
      "factor": "growth",
      "annualized_return": 0.391,
      "cumulative_returns": 2.54,
      "sharpe_ratio": 1.64,
      "sortino_ratio": 2.68,
      "years": 3.79
    },
    {
      "factor": "value",
      "annualized_return": 0.093,
      "cumulative_returns": 0.42,
      "sharpe_ratio": null,
      "sortino_ratio": null,
      "years": null
    }
  ]
}
```

**Example**

```bash
curl http://localhost:8000/factors/compare
```

---

### Compute Endpoints

These endpoints require the `ARTEMIS_API_KEY` environment variable to be set.

#### `POST /compute/smb`

Compute the SMB (Small Minus Big) size factor with custom configuration.

**Request Body**

```json
{
  "factor": "smb",
  "breakpoint": 0.5,
  "min_assets": 30,
  "weighting_method": "equal",
  "start_date": "2021-01-01",
  "end_date": "2025-01-01",
  "market_cap_threshold": 100000000,
  "liquidity_threshold": 35000000,
  "min_lifetime_days": 30
}
```

**Request Parameters**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `factor` | string | required | Factor name |
| `breakpoint` | float | 0.5 | Percentile split for long/short (0.1-0.5) |
| `min_assets` | integer | 30 | Minimum assets per period (>=5) |
| `weighting_method` | string | "equal" | `equal`, `market_cap`, or `inverse_variance` |
| `start_date` | string | required | Start date (YYYY-MM-DD) |
| `end_date` | string | required | End date (YYYY-MM-DD) |
| `market_cap_threshold` | integer | 100000000 | Minimum market cap filter ($) |
| `liquidity_threshold` | integer | 35000000 | Minimum 24h volume filter ($) |
| `min_lifetime_days` | integer | 30 | Minimum asset age in days |

**Response**

```json
{
  "factor": "smb",
  "config": {
    "factor": "smb",
    "breakpoint": 0.5,
    "min_assets": 30,
    "weighting_method": "equal",
    "start_date": "2021-01-01",
    "end_date": "2025-01-01",
    "market_cap_threshold": 100000000,
    "liquidity_threshold": 35000000,
    "min_lifetime_days": 30
  },
  "performance": {
    "cumulative_returns": 5.23,
    "annualized_return": 0.48,
    "sharpe_ratio": 1.32,
    "years": 4.0,
    "num_periods": 208
  },
  "returns": {
    "2024-12-01": 0.023,
    "2024-12-08": -0.015,
    "2024-12-15": 0.041,
    "2024-12-22": 0.018,
    "2024-12-29": -0.008
  }
}
```

**Example**

```bash
curl -X POST http://localhost:8000/compute/smb \
  -H "Content-Type: application/json" \
  -d '{
    "factor": "smb",
    "breakpoint": 0.5,
    "min_assets": 40,
    "weighting_method": "equal",
    "start_date": "2022-01-01",
    "end_date": "2025-01-01"
  }'
```

---

#### `POST /compute/momentum`

Compute the momentum factor with volatility adjustment.

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lookback_periods` | integer | 3 | Lookback periods for momentum (1-12 weeks) |

**Request Body**

Same as `/compute/smb`

**Response**

```json
{
  "factor": "momentum",
  "config": {
    "factor": "momentum",
    "breakpoint": 0.25,
    "min_assets": 30,
    "weighting_method": "equal",
    "start_date": "2021-01-01",
    "end_date": "2025-01-01",
    "lookback_periods": 3
  },
  "performance": {
    "cumulative_returns": 8.45,
    "annualized_return": 0.62,
    "sharpe_ratio": 1.28,
    "sortino_ratio": 2.15,
    "years": 4.0,
    "num_periods": 208
  },
  "returns": {
    "2024-12-29": 0.034
  }
}
```

**Example**

```bash
curl -X POST "http://localhost:8000/compute/momentum?lookback_periods=4" \
  -H "Content-Type: application/json" \
  -d '{
    "factor": "momentum",
    "breakpoint": 0.25,
    "min_assets": 30,
    "weighting_method": "equal",
    "start_date": "2021-01-01",
    "end_date": "2025-01-01"
  }'
```

---

## Data Models

### FactorConfig

Configuration for computing a factor model.

```python
class FactorConfig:
    factor: str                          # Factor name
    breakpoint: float = 0.5              # Portfolio split percentile (0.1-0.5)
    min_assets: int = 30                 # Minimum assets per period (>=5)
    weighting_method: str = "equal"      # equal, market_cap, inverse_variance
    start_date: str                      # YYYY-MM-DD
    end_date: str                        # YYYY-MM-DD
    market_cap_threshold: int = 100000000
    liquidity_threshold: int = 35000000
    min_lifetime_days: int = 30
```

### FactorPerformance

Performance metrics returned from log endpoints.

```python
class FactorPerformance:
    run_id: str                          # Timestamp ID (YYYYMMDD_HHMMSS)
    factor: str                          # Factor name
    breakpoint: float | None             # Portfolio split used
    min_assets: int | None               # Min assets threshold
    weighting_method: str | None         # Weighting scheme
    cumulative_returns: float | None     # Total return (e.g., 12.17 = 1217%)
    annualized_return: float | None      # Annual return (e.g., 0.747 = 74.7%)
    years: float | None                  # Backtest duration
    sharpe_ratio: float | None           # Risk-adjusted return (annualized)
    sortino_ratio: float | None          # Downside-adjusted return (annualized)
    long_only_returns: float | None      # Long portfolio cumulative
    short_only_returns: float | None     # Short portfolio cumulative
    start_date: str | None               # Backtest start
    end_date: str | None                 # Backtest end
```

---

## Factor Descriptions

### SMB (Small Minus Big)

**Purpose**: Tests whether small-cap crypto assets outperform large-cap assets.

| Parameter | Value |
|-----------|-------|
| Signal | Market capitalization |
| Long Portfolio | Smallest X% by market cap |
| Short Portfolio | Largest X% by market cap |
| Typical Breakpoint | 0.5 (50/50 split) |
| Rebalance Frequency | Weekly |

**Historical Performance** (as of Oct 2025):
- Annualized Return: ~54%
- Sharpe Ratio: ~1.45
- Sortino Ratio: ~3.30

---

### Market Factor

**Purpose**: Represents overall crypto market returns using top assets.

| Parameter | Value |
|-----------|-------|
| Signal | Market cap rank |
| Portfolio | Top 10 assets by market cap |
| Weighting | Market cap weighted |
| Rebalance Frequency | Weekly |

**Historical Performance**:
- Annualized Return: ~42%
- Sharpe Ratio: ~0.82

---

### Value Factor

**Purpose**: Tests if protocols with low fees relative to market cap outperform.

| Parameter | Value |
|-----------|-------|
| Signal | MC-to-Fees Ratio |
| Long Portfolio | High MC/Fees ratio (undervalued) |
| Short Portfolio | Low MC/Fees ratio (overvalued) |
| Typical Breakpoint | 0.5 |

**Historical Performance**:
- Annualized Return: ~9%
- Underperforms other factors

---

### Momentum Factor

**Purpose**: Basic trend-following using price momentum.

| Parameter | Value |
|-----------|-------|
| Signal | Price return over lookback period |
| Long Portfolio | Top X% momentum |
| Short Portfolio | Bottom X% momentum |
| Lookback | Configurable (default 3 weeks) |

---

### Momentum V2 (Volatility-Adjusted)

**Purpose**: Enhanced momentum with risk adjustment.

| Parameter | Value |
|-----------|-------|
| Signal | `momentum * (|mean_return| / std)` |
| Long Portfolio | Top 25% by filtered momentum |
| Short Portfolio | Bottom 25% by filtered momentum |
| Lookback | 3 weeks (21 days) |

**Historical Performance** (best performer):
- Annualized Return: ~75%
- Sharpe Ratio: ~1.41
- Sortino Ratio: ~2.98
- Long-only returns: ~8x
- Short-only returns: ~-0.55x

---

### Growth Factor

**Purpose**: Composite factor using fundamental protocol metrics.

| Parameter | Value |
|-----------|-------|
| Signals | Fees growth, DAU growth, Revenue growth |
| Long Portfolio | Top X% by composite growth |
| Short Portfolio | Bottom X% by composite growth |
| Growth Window | 2 weeks |

**Historical Performance**:
- Annualized Return: ~39%
- Sharpe Ratio: ~1.64
- Sortino Ratio: ~2.68

---

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad request (invalid parameters, no data returned) |
| 404 | Factor not found or no logs available |
| 422 | Validation error (invalid request body) |
| 500 | Server error (missing API key, internal error) |

### Error Response Format

```json
{
  "detail": "Error message describing the issue"
}
```

### Common Errors

**Factor not found**
```json
{
  "detail": "Factor 'invalid_factor' not found"
}
```

**Missing API key for compute**
```json
{
  "detail": "ARTEMIS_API_KEY environment variable not set"
}
```

**No data returned**
```json
{
  "detail": "No factor returns computed - check data availability"
}
```

---

## Examples

### Python Client

```python
import requests

BASE_URL = "http://localhost:8000"

# Get all factors
response = requests.get(f"{BASE_URL}/factors")
factors = response.json()["factors"]
print(f"Available factors: {[f['name'] for f in factors]}")

# Get latest momentum performance
response = requests.get(f"{BASE_URL}/factors/momentum_v2/latest")
perf = response.json()
print(f"Momentum V2 Annualized Return: {perf['annualized_return']:.1%}")
print(f"Momentum V2 Sharpe Ratio: {perf['sharpe_ratio']:.2f}")

# Compare all factors
response = requests.get(f"{BASE_URL}/factors/compare")
comparison = response.json()["comparison"]
for factor in comparison:
    ret = factor.get("annualized_return") or 0
    print(f"{factor['factor']}: {ret:.1%}")

# Compute custom SMB factor
config = {
    "factor": "smb",
    "breakpoint": 0.4,
    "min_assets": 50,
    "weighting_method": "equal",
    "start_date": "2022-01-01",
    "end_date": "2024-12-31",
    "market_cap_threshold": 200000000
}
response = requests.post(f"{BASE_URL}/compute/smb", json=config)
result = response.json()
print(f"Computed Sharpe: {result['performance']['sharpe_ratio']:.2f}")
```

### JavaScript/TypeScript Client

```typescript
const BASE_URL = "http://localhost:8000";

// Get factor comparison
async function compareFactors() {
  const response = await fetch(`${BASE_URL}/factors/compare`);
  const data = await response.json();

  console.log("Factor Performance Ranking:");
  data.comparison.forEach((factor, i) => {
    const ret = factor.annualized_return ?? 0;
    console.log(`${i + 1}. ${factor.factor}: ${(ret * 100).toFixed(1)}%`);
  });
}

// Compute momentum factor
async function computeMomentum() {
  const config = {
    factor: "momentum",
    breakpoint: 0.25,
    min_assets: 30,
    weighting_method: "equal",
    start_date: "2021-01-01",
    end_date: "2025-01-01"
  };

  const response = await fetch(`${BASE_URL}/compute/momentum?lookback_periods=4`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config)
  });

  const result = await response.json();
  console.log(`Sharpe Ratio: ${result.performance.sharpe_ratio.toFixed(2)}`);
}
```

### cURL Examples

```bash
# List factors
curl -s http://localhost:8000/factors | jq '.factors[].name'

# Get SMB logs (last 3 runs)
curl -s "http://localhost:8000/factors/smb/logs?limit=3" | jq '.[].annualized_return'

# Compare factors and format output
curl -s http://localhost:8000/factors/compare | jq -r '.comparison[] | "\(.factor): \(.annualized_return // 0 | . * 100 | round)%"'

# Compute momentum with custom lookback
curl -X POST "http://localhost:8000/compute/momentum?lookback_periods=5" \
  -H "Content-Type: application/json" \
  -d '{"factor":"momentum","breakpoint":0.3,"min_assets":25,"weighting_method":"equal","start_date":"2022-06-01","end_date":"2024-12-01"}' \
  | jq '.performance'
```

---

## Performance Metrics Glossary

| Metric | Description | Formula |
|--------|-------------|---------|
| **Cumulative Returns** | Total return over the period | `(1 + r1) * (1 + r2) * ... - 1` |
| **Annualized Return** | Geometric mean annual return | `(1 + cum_ret)^(1/years) - 1` |
| **Sharpe Ratio** | Risk-adjusted return (annualized) | `mean(returns) / std(returns) * sqrt(52)` |
| **Sortino Ratio** | Downside risk-adjusted return | `mean(returns) / downside_std * sqrt(52)` |
| **Long-Only Returns** | Returns from long portfolio only | Sum of long portfolio returns |
| **Short-Only Returns** | Returns from short portfolio only | Sum of short portfolio returns |

---

## Changelog

### v1.0.0 (2025-01-23)

- Initial release
- Support for 6 factor models: SMB, Market, Value, Momentum, Momentum V2, Growth
- Historical log retrieval endpoints
- Factor comparison endpoint
- Compute endpoints for SMB and Momentum factors
- Interactive API documentation via Swagger UI
