use crate::data::mappings::ARTEMIS_TO_COINBASE;
use crate::error::{Error, Result};
use chrono::NaiveDate;
use polars::prelude::*;
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;
use tracing::{debug, warn};

/// Coinbase API client for fetching price and volume data
#[derive(Clone)]
pub struct CoinbaseClient {
    base_url: String,
    client: Client,
    max_candles_per_request: i64,
    rate_limit_delay_ms: u64,
}

/// Candle data from Coinbase API
#[derive(Debug, Deserialize, Clone)]
struct Candle {
    start: String,
    #[allow(dead_code)]
    open: String,
    #[allow(dead_code)]
    high: String,
    #[allow(dead_code)]
    low: String,
    close: String,
    volume: String,
}

/// Response from Coinbase candles endpoint
#[derive(Debug, Deserialize)]
struct CandlesResponse {
    candles: Vec<Candle>,
}

impl CoinbaseClient {
    /// Create a new Coinbase API client
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");

        Self {
            base_url,
            client,
            max_candles_per_request: 300, // Coinbase limit
            rate_limit_delay_ms: 100,      // 0.1s delay
        }
    }

    /// Fetch price and volume for multiple Artemis symbols
    ///
    /// # Arguments
    /// * `symbols` - List of Artemis symbol names (e.g., ["bitcoin", "ethereum"])
    /// * `start_date` - Start date for price data
    /// * `end_date` - End date for price data
    ///
    /// # Returns
    /// DataFrame with columns: [date, asset, price, 24h_volume]
    pub async fn get_price_volume_for_symbols(
        &self,
        symbols: Vec<String>,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<DataFrame> {
        if symbols.is_empty() {
            return Err(Error::InvalidInput("No symbols provided".to_string()));
        }

        debug!(
            "Fetching price/volume for {} symbols ({} to {})",
            symbols.len(),
            start_date,
            end_date
        );

        // Fetch all symbols concurrently
        let mut tasks: Vec<tokio::task::JoinHandle<Result<Option<DataFrame>>>> = Vec::new();

        for symbol in symbols {
            let client = self.clone();
            let start = start_date;
            let end = end_date;

            let task = tokio::spawn(async move {
                // Map Artemis symbol to Coinbase product ID
                let product_id: String = match ARTEMIS_TO_COINBASE.get(symbol.as_str()) {
                    Some(&id) => id.to_string(),
                    None => {
                        warn!("No Coinbase mapping for symbol: {}", symbol);
                        return Ok(None);
                    }
                };

                match client.get_candles(&product_id, start, end).await {
                    Ok(df) => {
                        if df.height() == 0 {
                            Ok(None)
                        } else {
                            // Add asset column with Artemis symbol name
                            let mut df_with_asset = df
                                .lazy()
                                .with_column(lit(symbol).alias("asset"))
                                .collect()?;
                            Ok(Some(df_with_asset))
                        }
                    }
                    Err(e) => {
                        warn!("Failed to fetch candles for {}: {}", symbol, e);
                        Ok(None)
                    }
                }
            });

            tasks.push(task);
        }

        // Wait for all tasks to complete
        let results = futures::future::join_all(tasks).await;

        // Collect successful DataFrames
        let mut dfs = Vec::new();

        for result in results {
            match result {
                Ok(Ok(Some(df))) => dfs.push(df),
                Ok(Ok(None)) => {} // No data for this symbol
                Ok(Err(e)) => {
                    warn!("Task failed: {}", e);
                }
                Err(e) => {
                    warn!("Task panicked: {}", e);
                }
            }
        }

        if dfs.is_empty() {
            // Return empty DataFrame with expected schema
            return Ok(DataFrame::new(vec![
                Series::new("date", Vec::<i64>::new()),
                Series::new("asset", Vec::<String>::new()),
                Series::new("price", Vec::<f64>::new()),
                Series::new("24h_volume", Vec::<f64>::new()),
            ])
            .map_err(|e| Error::Polars(e))?);
        }

        // Concatenate all DataFrames
        let combined = dfs
            .into_iter()
            .reduce(|mut acc, df| {
                acc.vstack_mut(&df).ok();
                acc
            })
            .ok_or_else(|| Error::Internal("Failed to concatenate DataFrames".to_string()))?;

        debug!(
            "Combined price/volume DataFrame: {} rows, {} columns",
            combined.height(),
            combined.width()
        );

        Ok(combined)
    }

    /// Get candles for a specific Coinbase product ID
    ///
    /// # Arguments
    /// * `product_id` - Coinbase product ID (e.g., "BTC-USD")
    /// * `start_date` - Start date for candles
    /// * `end_date` - End date for candles
    ///
    /// # Returns
    /// DataFrame with columns: [date, price, 24h_volume]
    async fn get_candles(
        &self,
        product_id: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<DataFrame> {
        let url = format!("{}/products/{}/candles", self.base_url, product_id);

        let mut all_candles = Vec::new();
        let mut current_start = start_date;

        // Paginate through date ranges (300 days per request)
        while current_start <= end_date {
            let current_end = std::cmp::min(
                current_start + chrono::Duration::days(self.max_candles_per_request - 1),
                end_date,
            );

            // Fetch one page with retry logic
            match self
                .fetch_candles_page(&url, product_id, current_start, current_end)
                .await
            {
                Ok(candles) => all_candles.extend(candles),
                Err(e) => {
                    warn!(
                        "Failed to fetch candles for {} ({} to {}): {}",
                        product_id, current_start, current_end, e
                    );
                }
            }

            current_start = current_end + chrono::Duration::days(1);

            // Rate limiting
            tokio::time::sleep(Duration::from_millis(self.rate_limit_delay_ms)).await;
        }

        if all_candles.is_empty() {
            return Ok(DataFrame::new(vec![
                Series::new("date", Vec::<i64>::new()),
                Series::new("price", Vec::<f64>::new()),
                Series::new("24h_volume", Vec::<f64>::new()),
            ])
            .map_err(|e| Error::Polars(e))?);
        }

        // Convert to DataFrame
        self.candles_to_dataframe(all_candles)
    }

    /// Fetch a single page of candles with retry logic
    async fn fetch_candles_page(
        &self,
        url: &str,
        product_id: &str,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Vec<Candle>> {
        let start_timestamp = start_date
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            .timestamp();
        let end_timestamp = end_date
            .and_hms_opt(23, 59, 59)
            .unwrap()
            .and_utc()
            .timestamp();

        let params = [
            ("start", start_timestamp.to_string()),
            ("end", end_timestamp.to_string()),
            ("granularity", "ONE_DAY".to_string()),
        ];

        // Retry logic: 3 attempts with exponential backoff
        let mut attempts = 0;
        let max_attempts = 3;

        loop {
            match self.client.get(url).query(&params).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        match response.json::<CandlesResponse>().await {
                            Ok(candles_response) => return Ok(candles_response.candles),
                            Err(e) => {
                                if attempts >= max_attempts - 1 {
                                    return Err(Error::DataFetch(format!(
                                        "Failed to parse Coinbase response: {}",
                                        e
                                    )));
                                }
                            }
                        }
                    } else if attempts >= max_attempts - 1 {
                        return Err(Error::DataFetch(format!(
                            "Coinbase API error for {}: {}",
                            product_id,
                            response.status()
                        )));
                    }
                }
                Err(e) => {
                    if attempts >= max_attempts - 1 {
                        return Err(Error::DataFetch(format!(
                            "Failed to fetch candles for {}: {}",
                            product_id, e
                        )));
                    }
                }
            }

            // Exponential backoff
            attempts += 1;
            let delay_ms = 100 * 2_u64.pow(attempts);
            tokio::time::sleep(Duration::from_millis(delay_ms)).await;
        }
    }

    /// Convert candles to Polars DataFrame
    fn candles_to_dataframe(&self, candles: Vec<Candle>) -> Result<DataFrame> {
        let mut dates = Vec::new();
        let mut prices = Vec::new();
        let mut volumes = Vec::new();

        for candle in candles {
            // Parse timestamp
            let timestamp = candle
                .start
                .parse::<i64>()
                .map_err(|e| Error::DataFetch(format!("Invalid timestamp: {}", e)))?;

            // Parse price (use close price)
            let price = candle
                .close
                .parse::<f64>()
                .map_err(|e| Error::DataFetch(format!("Invalid price: {}", e)))?;

            // Parse volume
            let volume = candle
                .volume
                .parse::<f64>()
                .map_err(|e| Error::DataFetch(format!("Invalid volume: {}", e)))?;

            dates.push(timestamp * 1000); // Convert to milliseconds
            prices.push(price);
            volumes.push(volume);
        }

        let df = DataFrame::new(vec![
            Series::new("timestamp", dates),
            Series::new("price", prices),
            Series::new("24h_volume", volumes),
        ])
        .map_err(|e| Error::Polars(e))?;

        // Convert timestamp to datetime
        df = df
            .lazy()
            .with_column(
                col("timestamp")
                    .cast(DataType::Datetime(TimeUnit::Milliseconds, None))
                    .alias("date"),
            )
            .select([col("date"), col("price"), col("24h_volume")])
            .collect()
            .map_err(|e| Error::Polars(e))?;

        // Sort by date and remove duplicates
        df = df
            .lazy()
            .sort("date", SortOptions::default())
            .collect()?;

        // Drop duplicates by date
        df = df.unique(Some(&["date".to_string()]), UniqueKeepStrategy::First, None)?;

        Ok(df)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_coinbase_client_creation() {
        let client = CoinbaseClient::new("https://api.exchange.coinbase.com".to_string());
        assert_eq!(client.max_candles_per_request, 300);
    }

    // Additional tests would require mocking the HTTP client
    // or using integration tests with real API
}
