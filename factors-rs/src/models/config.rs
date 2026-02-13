use serde::{Deserialize, Serialize};

/// Configuration for running a factor model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactorConfig {
    /// Factor name (smb, market, value, momentum, momentum_v2, growth)
    pub factor: String,

    /// Percentile breakpoint for portfolio splits (0.1-0.5)
    #[serde(default = "default_breakpoint")]
    pub breakpoint: f64,

    /// Minimum assets per period
    #[serde(default = "default_min_assets")]
    pub min_assets: usize,

    /// Weighting method: equal, market_cap, inverse_variance
    #[serde(default = "default_weighting_method")]
    pub weighting_method: String,

    /// Start date (YYYY-MM-DD)
    pub start_date: String,

    /// End date (YYYY-MM-DD)
    pub end_date: String,

    /// Minimum market cap filter (optional)
    #[serde(default = "default_market_cap_threshold")]
    pub market_cap_threshold: Option<u64>,

    /// Minimum 24h volume filter (optional)
    #[serde(default = "default_liquidity_threshold")]
    pub liquidity_threshold: Option<u64>,

    /// Minimum asset lifetime in days (optional)
    #[serde(default = "default_min_lifetime_days")]
    pub min_lifetime_days: Option<u32>,
}

fn default_breakpoint() -> f64 {
    0.5
}

fn default_min_assets() -> usize {
    30
}

fn default_weighting_method() -> String {
    "equal".to_string()
}

fn default_market_cap_threshold() -> Option<u64> {
    Some(100_000_000)
}

fn default_liquidity_threshold() -> Option<u64> {
    Some(35_000_000)
}

fn default_min_lifetime_days() -> Option<u32> {
    Some(30)
}

impl FactorConfig {
    /// Validate the configuration
    pub fn validate(&self) -> crate::Result<()> {
        if self.breakpoint < 0.1 || self.breakpoint > 0.5 {
            return Err(crate::Error::InvalidInput(
                "breakpoint must be between 0.1 and 0.5".to_string(),
            ));
        }

        if self.min_assets < 5 {
            return Err(crate::Error::InvalidInput(
                "min_assets must be at least 5".to_string(),
            ));
        }

        if !["equal", "market_cap", "inverse_variance"].contains(&self.weighting_method.as_str()) {
            return Err(crate::Error::InvalidInput(format!(
                "Invalid weighting_method: {}. Must be one of: equal, market_cap, inverse_variance",
                self.weighting_method
            )));
        }

        // Validate dates
        chrono::NaiveDate::parse_from_str(&self.start_date, "%Y-%m-%d")
            .map_err(|e| crate::Error::DateParse(format!("Invalid start_date: {}", e)))?;

        chrono::NaiveDate::parse_from_str(&self.end_date, "%Y-%m-%d")
            .map_err(|e| crate::Error::DateParse(format!("Invalid end_date: {}", e)))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_factor_config_validation() {
        let mut config = FactorConfig {
            factor: "smb".to_string(),
            breakpoint: 0.3,
            min_assets: 30,
            weighting_method: "equal".to_string(),
            start_date: "2023-01-01".to_string(),
            end_date: "2023-12-31".to_string(),
            market_cap_threshold: Some(100_000_000),
            liquidity_threshold: Some(35_000_000),
            min_lifetime_days: Some(30),
        };

        assert!(config.validate().is_ok());

        config.breakpoint = 0.05;
        assert!(config.validate().is_err());

        config.breakpoint = 0.3;
        config.weighting_method = "invalid".to_string();
        assert!(config.validate().is_err());
    }
}
