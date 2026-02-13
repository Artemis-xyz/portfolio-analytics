use crate::error::{Error, Result};
use std::env;

/// Application configuration loaded from environment variables
#[derive(Debug, Clone)]
pub struct Config {
    /// Server port
    pub port: u16,

    /// Artemis API key
    pub artemis_api_key: String,

    /// Artemis API base URL
    pub artemis_api_url: String,

    /// Coinbase API base URL
    pub coinbase_api_url: String,

    /// Directory for factor log CSV files
    pub factor_logs_dir: String,

    /// Maximum concurrent API requests
    pub max_concurrent_requests: usize,

    /// API request timeout in seconds
    pub api_timeout_secs: u64,

    /// Log level
    pub log_level: String,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self> {
        // Load .env file if it exists
        let _ = dotenvy::dotenv();

        Ok(Config {
            port: env::var("PORT")
                .unwrap_or_else(|_| "8000".to_string())
                .parse()
                .map_err(|e| Error::Config(format!("Invalid PORT: {}", e)))?,

            artemis_api_key: env::var("ARTEMIS_API_KEY")
                .map_err(|_| Error::Config("ARTEMIS_API_KEY not set".to_string()))?,

            artemis_api_url: env::var("ARTEMIS_API_URL")
                .unwrap_or_else(|_| "https://api.artemis.xyz/v1".to_string()),

            coinbase_api_url: env::var("COINBASE_API_URL")
                .unwrap_or_else(|_| "https://api.exchange.coinbase.com".to_string()),

            factor_logs_dir: env::var("FACTOR_LOGS_DIR")
                .unwrap_or_else(|_| "factor_logs".to_string()),

            max_concurrent_requests: env::var("MAX_CONCURRENT_REQUESTS")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .unwrap_or(100),

            api_timeout_secs: env::var("API_TIMEOUT_SECONDS")
                .unwrap_or_else(|_| "30".to_string())
                .parse()
                .unwrap_or(30),

            log_level: env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()),
        })
    }

    /// Validate the configuration
    pub fn validate(&self) -> Result<()> {
        if self.artemis_api_key.is_empty() {
            return Err(Error::Config(
                "ARTEMIS_API_KEY cannot be empty".to_string(),
            ));
        }

        if self.port == 0 {
            return Err(Error::Config("PORT must be greater than 0".to_string()));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_validation() {
        let mut config = Config {
            port: 8000,
            artemis_api_key: "test_key".to_string(),
            artemis_api_url: "https://api.test.com".to_string(),
            coinbase_api_url: "https://coinbase.test.com".to_string(),
            factor_logs_dir: "logs".to_string(),
            max_concurrent_requests: 100,
            api_timeout_secs: 30,
            log_level: "info".to_string(),
        };

        assert!(config.validate().is_ok());

        config.artemis_api_key = "".to_string();
        assert!(config.validate().is_err());
    }
}
