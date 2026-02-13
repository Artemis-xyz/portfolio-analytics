use serde::{Deserialize, Serialize};

/// Factor performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactorPerformance {
    pub run_id: String,
    pub factor: String,
    pub breakpoint: Option<f64>,
    pub min_assets: Option<usize>,
    pub weighting_method: Option<String>,
    pub cumulative_returns: Option<f64>,
    pub annualized_return: Option<f64>,
    pub years: Option<f64>,
    pub sharpe_ratio: Option<f64>,
    pub sortino_ratio: Option<f64>,
    pub long_only_returns: Option<f64>,
    pub short_only_returns: Option<f64>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

/// Factor comparison data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactorComparison {
    pub factor: String,
    pub annualized_return: Option<f64>,
    pub cumulative_returns: Option<f64>,
    pub sharpe_ratio: Option<f64>,
    pub sortino_ratio: Option<f64>,
    pub years: Option<f64>,
}

/// Compute factor response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComputeFactorResponse {
    pub factor: String,
    pub config: serde_json::Value,
    pub performance: PerformanceMetrics,
    pub returns: std::collections::HashMap<String, f64>,
}

/// Performance metrics subset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub cumulative_returns: f64,
    pub annualized_return: f64,
    pub sharpe_ratio: f64,
    pub sortino_ratio: Option<f64>,
    pub years: f64,
    pub num_periods: usize,
    pub long_only_returns: Option<f64>,
    pub short_only_returns: Option<f64>,
}
