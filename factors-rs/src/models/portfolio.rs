use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Portfolio composition for a given date
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortfolioComposition {
    pub date: String,
    pub long_portfolio: HashMap<String, AssetPosition>,
    pub short_portfolio: HashMap<String, AssetPosition>,
}

/// Asset position details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetPosition {
    pub weight: f64,
    pub price: Option<f64>,
    pub market_cap: Option<f64>,
    pub volume_24h: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signal_value: Option<f64>,
}
