use axum::{
    extract::{Path, Query},
    Extension, Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

use crate::error::{Error, Result};
use crate::logger::CsvLogger;
use crate::models::{FactorPerformance, FactorReturns};
use crate::Config;

const AVAILABLE_FACTORS: &[&str] = &["smb", "market", "value", "momentum", "momentum_v2", "growth"];

#[derive(Debug, Deserialize)]
pub struct FactorLogsQuery {
    #[serde(default = "default_limit")]
    limit: usize,
}

fn default_limit() -> usize {
    10
}

#[derive(Debug, Deserialize)]
pub struct TimeSeriesQuery {
    #[serde(default)]
    factors: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    #[serde(default = "default_true")]
    normalize_to_100: bool,
}

fn default_true() -> bool {
    true
}

/// Root endpoint
pub async fn root() -> Json<Value> {
    Json(json!({
        "name": "Factor Models API",
        "version": "1.0.0",
        "available_factors": AVAILABLE_FACTORS,
        "endpoints": {
            "/factors": "List all available factors",
            "/factors/{factor}/logs": "Get historical performance logs for a factor",
            "/factors/{factor}/latest": "Get latest performance for a factor",
            "/factors/compare": "Compare performance across all factors",
            "/factors/time-series": "Get time series data for factors",
            "/compute": "Compute a new factor model (POST)",
            "/health": "Health check",
        },
    }))
}

/// List all available factors
pub async fn list_factors() -> Json<Value> {
    Json(json!({
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
    }))
}

/// Get historical performance logs for a factor
pub async fn get_factor_logs(
    Path(factor): Path<String>,
    Query(query): Query<FactorLogsQuery>,
    Extension(config): Extension<Arc<Config>>,
) -> Result<Json<Vec<FactorPerformance>>> {
    if !AVAILABLE_FACTORS.contains(&factor.as_str()) {
        return Err(Error::NotFound(format!("Factor '{}' not found", factor)));
    }

    let logger = CsvLogger::new(&config.factor_logs_dir)?;
    let mut logs = logger.load_factor_logs(&factor)?;

    // Get last N logs
    if logs.len() > query.limit {
        logs = logs.split_off(logs.len() - query.limit);
    }

    Ok(Json(logs))
}

/// Get latest performance for a factor
pub async fn get_factor_latest(
    Path(factor): Path<String>,
    Extension(config): Extension<Arc<Config>>,
) -> Result<Json<FactorPerformance>> {
    if !AVAILABLE_FACTORS.contains(&factor.as_str()) {
        return Err(Error::NotFound(format!("Factor '{}' not found", factor)));
    }

    let logger = CsvLogger::new(&config.factor_logs_dir)?;
    let logs = logger.load_factor_logs(&factor)?;

    if logs.is_empty() {
        return Err(Error::NotFound(format!("No logs found for factor: {}", factor)));
    }

    let latest = logs.last().unwrap().clone();
    Ok(Json(latest))
}

/// Compare performance across all factors
pub async fn compare_factors(
    Extension(config): Extension<Arc<Config>>,
) -> Result<Json<Value>> {
    let logger = CsvLogger::new(&config.factor_logs_dir)?;
    let mut comparison = Vec::new();

    for factor in AVAILABLE_FACTORS {
        if let Ok(logs) = logger.load_factor_logs(factor) {
            if let Some(latest) = logs.last() {
                comparison.push(json!({
                    "factor": factor,
                    "annualized_return": latest.annualized_return,
                    "cumulative_returns": latest.cumulative_returns,
                    "sharpe_ratio": latest.sharpe_ratio,
                    "sortino_ratio": latest.sortino_ratio,
                    "years": latest.years,
                }));
            }
        }
    }

    // Sort by annualized return
    comparison.sort_by(|a, b| {
        let a_ret = a["annualized_return"].as_f64().unwrap_or(0.0);
        let b_ret = b["annualized_return"].as_f64().unwrap_or(0.0);
        b_ret.partial_cmp(&a_ret).unwrap()
    });

    Ok(Json(json!({ "comparison": comparison })))
}

/// Get time series data for multiple factors
pub async fn get_factors_time_series(
    Query(query): Query<TimeSeriesQuery>,
    Extension(config): Extension<Arc<Config>>,
) -> Result<Json<HashMap<String, FactorReturns>>> {
    let logger = CsvLogger::new(&config.factor_logs_dir)?;

    let factors_list = if let Some(factors_str) = query.factors {
        factors_str
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
    } else {
        AVAILABLE_FACTORS.iter().map(|s| s.to_string()).collect()
    };

    let mut result = HashMap::new();

    for factor in factors_list {
        if !AVAILABLE_FACTORS.contains(&factor.as_str()) {
            continue;
        }

        // Get latest run ID
        let logs = logger.load_factor_logs(&factor)?;
        if logs.is_empty() {
            continue;
        }

        let latest_run = logs.last().unwrap();
        let run_id = &latest_run.run_id;

        // Load time series
        if let Ok((mut dates, mut returns, mut cumulative_returns)) =
            logger.load_time_series(&factor, run_id)
        {
            // Filter by date range if provided
            if let Some(start_date) = &query.start_date {
                let indices: Vec<usize> = dates
                    .iter()
                    .enumerate()
                    .filter(|(_, d)| d.as_str() >= start_date.as_str())
                    .map(|(i, _)| i)
                    .collect();

                if !indices.is_empty() {
                    let start_idx = indices[0];
                    dates = dates.split_off(start_idx);
                    returns = returns.split_off(start_idx);
                    cumulative_returns = cumulative_returns.split_off(start_idx);
                }
            }

            if let Some(end_date) = &query.end_date {
                if let Some(end_idx) = dates.iter().position(|d| d.as_str() > end_date.as_str()) {
                    dates.truncate(end_idx);
                    returns.truncate(end_idx);
                    cumulative_returns.truncate(end_idx);
                }
            }

            // Normalize to 100 if requested
            if query.normalize_to_100 && !cumulative_returns.is_empty() {
                cumulative_returns = cumulative_returns
                    .iter()
                    .map(|v| (v + 1.0) * 100.0)
                    .collect();
            }

            result.insert(
                factor.clone(),
                FactorReturns {
                    factor: factor.clone(),
                    dates,
                    returns,
                    cumulative_returns,
                },
            );
        }
    }

    Ok(Json(result))
}
