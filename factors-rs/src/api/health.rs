use axum::{Extension, Json};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::Config;

/// Health check endpoint
pub async fn health_check(Extension(config): Extension<Arc<Config>>) -> Json<Value> {
    Json(json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "api_key_configured": !config.artemis_api_key.is_empty(),
    }))
}
