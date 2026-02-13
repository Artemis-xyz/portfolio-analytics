use axum::{
    routing::{get, post},
    Extension, Router,
};
use std::sync::Arc;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

// Use the library modules
use factors_rs::{api, config::Config};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    init_tracing();

    // Load configuration
    let config = Config::from_env()?;
    config.validate()?;

    tracing::info!(
        "Starting factors-rs server on port {}",
        config.port
    );

    // Create shared application state
    let config = Arc::new(config);

    // Build router
    let app = create_router(config.clone());

    // Start server
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", config.port))
        .await?;

    tracing::info!(
        "Server listening on http://0.0.0.0:{}",
        config.port
    );

    axum::serve(listener, app).await?;

    Ok(())
}

/// Initialize tracing/logging
fn init_tracing() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,factors_rs=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
}

/// Create the Axum router with all routes and middleware
fn create_router(config: Arc<Config>) -> Router {
    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router with all routes
    Router::new()
        // Root and metadata endpoints
        .route("/", get(api::factors::root))
        .route("/health", get(api::health::health_check))

        // Factor query endpoints
        .route("/factors", get(api::factors::list_factors))
        .route("/factors/compare", get(api::factors::compare_factors))
        .route("/factors/time-series", get(api::factors::get_factors_time_series))
        .route("/factors/:factor/logs", get(api::factors::get_factor_logs))
        .route("/factors/:factor/latest", get(api::factors::get_factor_latest))

        // Compute endpoints (placeholders for Week 2-3)
        .route("/compute/smb", post(api::compute::compute_smb))
        .route("/compute/momentum", post(api::compute::compute_momentum))
        .route("/compute/value", post(api::compute::compute_value))
        .route("/compute/market", post(api::compute::compute_market))
        .route("/compute/growth", post(api::compute::compute_growth))

        // Middleware
        .layer(Extension(config))
        .layer(cors)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_router_creation() {
        let config = Arc::new(Config {
            port: 8000,
            artemis_api_key: "test_key".to_string(),
            artemis_api_url: "https://api.test.com".to_string(),
            coinbase_api_url: "https://coinbase.test.com".to_string(),
            factor_logs_dir: "test_logs".to_string(),
            max_concurrent_requests: 100,
            api_timeout_secs: 30,
            log_level: "info".to_string(),
        });

        let _router = create_router(config);
        // Router created successfully
    }
}
