use crate::error::{Error, Result};
use chrono::NaiveDate;
use polars::prelude::*;
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;
use tracing::{debug, warn};

/// Artemis API client for fetching on-chain metrics
pub struct ArtemisClient {
    api_key: String,
    base_url: String,
    client: Client,
    /// Semaphore to limit concurrent requests (4 concurrent batches)
    semaphore: Arc<Semaphore>,
}

/// Response structure from Artemis list_asset_symbols API
#[derive(Debug, Deserialize)]
struct AssetListResponse {
    assets: Vec<AssetSymbol>,
}

#[derive(Debug, Deserialize)]
struct AssetSymbol {
    symbol: Option<String>,
}

/// Response structure from Artemis fetch_metrics API
#[derive(Debug, Deserialize)]
struct MetricsResponse {
    data: MetricsData,
}

#[derive(Debug, Deserialize)]
struct MetricsData {
    symbols: HashMap<String, HashMap<String, Vec<MetricDataPoint>>>,
}

#[derive(Debug, Deserialize, Clone)]
struct MetricDataPoint {
    #[serde(alias = "timestamp")]
    date: String,
    #[serde(alias = "val", alias = "value")]
    val: f64,
}

impl ArtemisClient {
    /// Create a new Artemis API client
    pub fn new(api_key: String, base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");

        Self {
            api_key,
            base_url,
            client,
            semaphore: Arc::new(Semaphore::new(4)), // 4 concurrent batches
        }
    }

    /// List all asset symbols from Artemis, filtered for crypto only
    pub async fn list_asset_symbols(&self) -> Result<Vec<String>> {
        let url = format!("{}/asset/symbols", self.base_url);

        debug!("Fetching asset symbols from Artemis API");

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await
            .map_err(|e| Error::DataFetch(format!("Failed to fetch asset symbols: {}", e)))?;

        if !response.status().is_success() {
            return Err(Error::DataFetch(format!(
                "Artemis API returned error: {}",
                response.status()
            )));
        }

        let asset_list: AssetListResponse = response
            .json()
            .await
            .map_err(|e| Error::DataFetch(format!("Failed to parse asset symbols: {}", e)))?;

        // Filter out equity symbols (contain "eq-"), stablecoins, and unwanted symbols
        let symbols: Vec<String> = asset_list
            .assets
            .into_iter()
            .filter_map(|asset| asset.symbol)
            .filter(|symbol| {
                !symbol.contains("eq-")
                    && symbol != "usd"
                    && symbol != "M"
                    && symbol != "eurc"
            })
            .collect();

        debug!("Found {} crypto symbols", symbols.len());

        Ok(symbols)
    }

    /// Fetch metrics for multiple symbols in parallel batches
    ///
    /// # Arguments
    /// * `symbols` - List of symbol names (e.g., ["bitcoin", "ethereum"])
    /// * `metrics` - List of metric names (e.g., ["mc", "fees", "dau"])
    /// * `start_date` - Start date for metrics
    /// * `end_date` - End date for metrics
    ///
    /// # Returns
    /// DataFrame with columns: [date, asset, metric1, metric2, ...]
    pub async fn fetch_metrics_parallel(
        &self,
        symbols: Vec<String>,
        metrics: Vec<String>,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<DataFrame> {
        if symbols.is_empty() {
            return Err(Error::InvalidInput("No symbols provided".to_string()));
        }

        if metrics.is_empty() {
            return Err(Error::InvalidInput("No metrics provided".to_string()));
        }

        debug!(
            "Fetching {} metrics for {} symbols ({} to {})",
            metrics.len(),
            symbols.len(),
            start_date,
            end_date
        );

        // Split symbols into batches of 5 (Artemis has 250 asset limit, we use 5 for faster requests)
        let batches: Vec<Vec<String>> = symbols
            .chunks(5)
            .map(|chunk| chunk.to_vec())
            .collect();

        debug!("Split into {} batches", batches.len());

        // Fetch batches in parallel with semaphore limiting concurrency
        let mut tasks = Vec::new();

        for batch in batches {
            let sem = self.semaphore.clone();
            let client = self.clone();
            let metrics_clone = metrics.clone();
            let start = start_date;
            let end = end_date;

            let task = tokio::spawn(async move {
                // Acquire permit (blocks if 4 requests already in flight)
                let _permit = sem.acquire().await.expect("Semaphore closed");
                client.fetch_batch(batch, metrics_clone, start, end).await
            });

            tasks.push(task);
        }

        // Wait for all tasks to complete
        let results = futures::future::join_all(tasks).await;

        // Collect successful DataFrames
        let mut dfs = Vec::new();
        let mut failed_count = 0;

        for result in results {
            match result {
                Ok(Ok(df)) => dfs.push(df),
                Ok(Err(e)) => {
                    warn!("Batch fetch failed: {}", e);
                    failed_count += 1;
                }
                Err(e) => {
                    warn!("Task panicked: {}", e);
                    failed_count += 1;
                }
            }
        }

        if failed_count > 0 {
            warn!("{} batches failed to fetch", failed_count);
        }

        if dfs.is_empty() {
            return Err(Error::DataFetch(
                "All batches failed, no data retrieved".to_string(),
            ));
        }

        // Concatenate all DataFrames vertically
        let combined = dfs
            .into_iter()
            .reduce(|mut acc, df| {
                acc.vstack_mut(&df).ok();
                acc
            })
            .ok_or_else(|| Error::Internal("Failed to concatenate DataFrames".to_string()))?;

        debug!(
            "Combined DataFrame: {} rows, {} columns",
            combined.height(),
            combined.width()
        );

        Ok(combined)
    }

    /// Fetch a single batch of symbols
    async fn fetch_batch(
        &self,
        symbols: Vec<String>,
        metrics: Vec<String>,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<DataFrame> {
        let url = format!("{}/metrics", self.base_url);
        let metrics_str = metrics.join(",");

        debug!(
            "Fetching batch of {} symbols: {:?}",
            symbols.len(),
            symbols
        );

        let request_body = serde_json::json!({
            "symbols": symbols,
            "metrics": metrics_str,
            "start_date": start_date.format("%Y-%m-%d").to_string(),
            "end_date": end_date.format("%Y-%m-%d").to_string(),
        });

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&request_body)
            .send()
            .await
            .map_err(|e| Error::DataFetch(format!("Failed to fetch metrics batch: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(Error::DataFetch(format!(
                "Artemis API error {}: {}",
                status, error_text
            )));
        }

        let metrics_response: MetricsResponse = response
            .json()
            .await
            .map_err(|e| Error::DataFetch(format!("Failed to parse metrics response: {}", e)))?;

        // Convert response to DataFrame
        self.parse_response_to_dataframe(metrics_response.data.symbols, &metrics)
    }

    /// Convert Artemis API response to Polars DataFrame
    ///
    /// Input structure: HashMap<asset, HashMap<metric, Vec<{date, val}>>>
    /// Output: DataFrame with [date, asset, metric1, metric2, ...]
    fn parse_response_to_dataframe(
        &self,
        symbols_data: HashMap<String, HashMap<String, Vec<MetricDataPoint>>>,
        _requested_metrics: &[String],
    ) -> Result<DataFrame> {
        // Collect all records: (date, asset, metric_name, value)
        let mut records: Vec<(String, String, String, f64)> = Vec::new();

        for (asset, metrics_dict) in symbols_data {
            for (metric_name, data_points) in metrics_dict {
                for point in data_points {
                    records.push((
                        point.date.clone(),
                        asset.clone(),
                        metric_name.clone(),
                        point.val,
                    ));
                }
            }
        }

        if records.is_empty() {
            return Err(Error::DataFetch(
                "No data points in Artemis API response".to_string(),
            ));
        }

        // Create initial DataFrame
        let dates: Vec<String> = records.iter().map(|(d, _, _, _)| d.clone()).collect();
        let assets: Vec<String> = records.iter().map(|(_, a, _, _)| a.clone()).collect();
        let metrics: Vec<String> = records.iter().map(|(_, _, m, _)| m.clone()).collect();
        let values: Vec<f64> = records.iter().map(|(_, _, _, v)| *v).collect();

        let df = DataFrame::new(vec![
            Series::new("date", dates),
            Series::new("asset", assets),
            Series::new("metric", metrics),
            Series::new("value", values),
        ])
        .map_err(|e| Error::Polars(e))?;

        // For now, return the long format DataFrame
        // We can pivot later in the factor model if needed
        // Polars pivot API varies between versions, so keep it simple
        let pivoted = df
            .lazy()
            .with_column(col("date").str().to_datetime(
                Some(TimeUnit::Milliseconds),
                None,
                StrptimeOptions::default(),
                lit("raise"),
            ))
            .collect()
            .map_err(|e| Error::Polars(e))?;

        debug!(
            "Parsed DataFrame: {} rows, {} columns",
            pivoted.height(),
            pivoted.width()
        );

        Ok(pivoted)
    }
}

// Implement Clone for use in async tasks
impl Clone for ArtemisClient {
    fn clone(&self) -> Self {
        Self {
            api_key: self.api_key.clone(),
            base_url: self.base_url.clone(),
            client: self.client.clone(),
            semaphore: self.semaphore.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_artemis_client_creation() {
        let client = ArtemisClient::new(
            "test_key".to_string(),
            "https://api.artemis.xyz/v1".to_string(),
        );
        assert_eq!(client.api_key, "test_key");
    }

    // Additional tests would require mocking the HTTP client
    // or using integration tests with real API
}
