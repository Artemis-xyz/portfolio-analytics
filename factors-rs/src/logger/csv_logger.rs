use crate::error::{Error, Result};
use crate::models::FactorPerformance;
use chrono::Utc;
use csv::{Reader, Writer};
use std::collections::HashMap;
use std::fs::{create_dir_all, File, OpenOptions};
use std::path::{Path, PathBuf};
use uuid::Uuid;

/// CSV logger for factor performance results
pub struct CsvLogger {
    logs_dir: PathBuf,
}

impl CsvLogger {
    /// Create a new CSV logger
    pub fn new<P: AsRef<Path>>(logs_dir: P) -> Result<Self> {
        let logs_dir = logs_dir.as_ref().to_path_buf();
        create_dir_all(&logs_dir)?;

        Ok(Self { logs_dir })
    }

    /// Generate a unique run ID
    pub fn generate_run_id() -> String {
        format!("{}_{}", Utc::now().format("%Y%m%d_%H%M%S"), Uuid::new_v4())
    }

    /// Log factor performance results to CSV
    pub fn log_results(
        &self,
        factor: &str,
        run_id: &str,
        breakpoint: Option<f64>,
        min_assets: Option<usize>,
        weighting_method: Option<&str>,
        cumulative_returns: Option<f64>,
        annualized_return: Option<f64>,
        years: Option<f64>,
        sharpe_ratio: Option<f64>,
        sortino_ratio: Option<f64>,
        long_only_returns: Option<f64>,
        short_only_returns: Option<f64>,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<()> {
        let file_path = self.logs_dir.join(format!("{}.csv", factor));
        let file_exists = file_path.exists();

        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_path)?;

        let mut writer = Writer::from_writer(file);

        // Write header if file is new
        if !file_exists {
            writer.write_record(&[
                "run_id",
                "factor",
                "breakpoint",
                "min_assets",
                "weighting_method",
                "cumulative_returns",
                "annualized_return",
                "years",
                "sharpe_ratio",
                "sortino_ratio",
                "long_only_returns",
                "short_only_returns",
                "start_date",
                "end_date",
            ])?;
        }

        // Write data row
        writer.write_record(&[
            run_id,
            factor,
            &breakpoint.map_or(String::new(), |v| v.to_string()),
            &min_assets.map_or(String::new(), |v| v.to_string()),
            weighting_method.unwrap_or(""),
            &cumulative_returns.map_or(String::new(), |v| v.to_string()),
            &annualized_return.map_or(String::new(), |v| v.to_string()),
            &years.map_or(String::new(), |v| v.to_string()),
            &sharpe_ratio.map_or(String::new(), |v| v.to_string()),
            &sortino_ratio.map_or(String::new(), |v| v.to_string()),
            &long_only_returns.map_or(String::new(), |v| v.to_string()),
            &short_only_returns.map_or(String::new(), |v| v.to_string()),
            start_date.unwrap_or(""),
            end_date.unwrap_or(""),
        ])?;

        writer.flush()?;
        Ok(())
    }

    /// Save time series data to CSV
    pub fn save_time_series(
        &self,
        factor: &str,
        run_id: &str,
        dates: &[String],
        returns: &[f64],
        cumulative_returns: &[f64],
    ) -> Result<()> {
        let file_path = self.logs_dir.join(format!("{}_{}_returns.csv", factor, run_id));
        let mut writer = Writer::from_path(file_path)?;

        // Write header
        writer.write_record(&["date", "return", "cumulative_return"])?;

        // Write data
        for i in 0..dates.len() {
            writer.write_record(&[
                &dates[i],
                &returns[i].to_string(),
                &cumulative_returns[i].to_string(),
            ])?;
        }

        writer.flush()?;
        Ok(())
    }

    /// Load factor logs from CSV
    pub fn load_factor_logs(&self, factor: &str) -> Result<Vec<FactorPerformance>> {
        let file_path = self.logs_dir.join(format!("{}.csv", factor));

        if !file_path.exists() {
            return Ok(Vec::new());
        }

        let file = File::open(file_path)?;
        let mut reader = Reader::from_reader(file);

        let mut results = Vec::new();

        for result in reader.deserialize() {
            // Deserialize with flexible handling of missing columns
            let record: HashMap<String, String> = result?;

            let performance = FactorPerformance {
                run_id: record.get("run_id").cloned().unwrap_or_default(),
                factor: record.get("factor").cloned().unwrap_or_else(|| factor.to_string()),
                breakpoint: record
                    .get("breakpoint")
                    .and_then(|s| s.parse::<f64>().ok()),
                min_assets: record
                    .get("min_assets")
                    .and_then(|s| s.parse::<usize>().ok()),
                weighting_method: record.get("weighting_method").cloned(),
                cumulative_returns: record
                    .get("cumulative_returns")
                    .and_then(|s| s.parse::<f64>().ok()),
                annualized_return: record
                    .get("annualized_return")
                    .and_then(|s| s.parse::<f64>().ok()),
                years: record.get("years").and_then(|s| s.parse::<f64>().ok()),
                sharpe_ratio: record
                    .get("sharpe_ratio")
                    .and_then(|s| s.parse::<f64>().ok()),
                sortino_ratio: record
                    .get("sortino_ratio")
                    .and_then(|s| s.parse::<f64>().ok()),
                long_only_returns: record
                    .get("long_only_returns")
                    .and_then(|s| s.parse::<f64>().ok()),
                short_only_returns: record
                    .get("short_only_returns")
                    .and_then(|s| s.parse::<f64>().ok()),
                start_date: record.get("start_date").cloned(),
                end_date: record.get("end_date").cloned(),
            };

            results.push(performance);
        }

        Ok(results)
    }

    /// Load time series data from CSV
    pub fn load_time_series(&self, factor: &str, run_id: &str) -> Result<(Vec<String>, Vec<f64>, Vec<f64>)> {
        let file_path = self.logs_dir.join(format!("{}_{}_returns.csv", factor, run_id));

        if !file_path.exists() {
            return Err(Error::NotFound(format!(
                "Time series file not found: {}_{}_returns.csv",
                factor, run_id
            )));
        }

        let file = File::open(file_path)?;
        let mut reader = Reader::from_reader(file);

        let mut dates = Vec::new();
        let mut returns = Vec::new();
        let mut cumulative_returns = Vec::new();

        for result in reader.deserialize() {
            let record: HashMap<String, String> = result?;

            if let (Some(date), Some(ret), Some(cum_ret)) = (
                record.get("date"),
                record.get("return").and_then(|s| s.parse::<f64>().ok()),
                record.get("cumulative_return").and_then(|s| s.parse::<f64>().ok()),
            ) {
                dates.push(date.clone());
                returns.push(ret);
                cumulative_returns.push(cum_ret);
            }
        }

        Ok((dates, returns, cumulative_returns))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_csv_logger() {
        let temp_dir = tempdir().unwrap();
        let logger = CsvLogger::new(temp_dir.path()).unwrap();

        let run_id = CsvLogger::generate_run_id();

        // Log results
        logger
            .log_results(
                "smb",
                &run_id,
                Some(0.3),
                Some(30),
                Some("equal"),
                Some(0.5),
                Some(0.15),
                Some(2.5),
                Some(1.2),
                Some(1.3),
                Some(0.3),
                Some(0.2),
                Some("2023-01-01"),
                Some("2023-12-31"),
            )
            .unwrap();

        // Load results
        let results = logger.load_factor_logs("smb").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].factor, "smb");
        assert_eq!(results[0].breakpoint, Some(0.3));
    }

    #[test]
    fn test_time_series() {
        let temp_dir = tempdir().unwrap();
        let logger = CsvLogger::new(temp_dir.path()).unwrap();

        let run_id = CsvLogger::generate_run_id();
        let dates = vec!["2023-01-01".to_string(), "2023-01-08".to_string()];
        let returns = vec![0.01, 0.02];
        let cumulative_returns = vec![0.01, 0.0302];

        // Save time series
        logger
            .save_time_series("smb", &run_id, &dates, &returns, &cumulative_returns)
            .unwrap();

        // Load time series
        let (loaded_dates, loaded_returns, loaded_cum_returns) =
            logger.load_time_series("smb", &run_id).unwrap();

        assert_eq!(loaded_dates, dates);
        assert_eq!(loaded_returns, returns);
        assert_eq!(loaded_cum_returns, cumulative_returns);
    }
}
