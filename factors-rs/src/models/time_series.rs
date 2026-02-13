use serde::{Deserialize, Serialize};

/// Factor returns time series
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactorReturns {
    pub factor: String,
    pub dates: Vec<String>,
    pub returns: Vec<f64>,
    pub cumulative_returns: Vec<f64>,
}

/// Time series data point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSeriesData {
    pub date: String,
    pub value: f64,
    pub cumulative_return: f64,
}
