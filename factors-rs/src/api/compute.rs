// Compute factor endpoints - to be implemented in Week 2-3

use axum::Json;
use serde_json::{json, Value};

use crate::error::Result;
use crate::models::FactorConfig;

/// Compute SMB factor (placeholder)
pub async fn compute_smb(_config: Json<FactorConfig>) -> Result<Json<Value>> {
    Ok(Json(json!({
        "status": "not_implemented",
        "message": "SMB computation will be implemented in Week 2-3"
    })))
}

/// Compute Momentum factor (placeholder)
pub async fn compute_momentum(_config: Json<FactorConfig>) -> Result<Json<Value>> {
    Ok(Json(json!({
        "status": "not_implemented",
        "message": "Momentum computation will be implemented in Week 2-3"
    })))
}

/// Compute Value factor (placeholder)
pub async fn compute_value(_config: Json<FactorConfig>) -> Result<Json<Value>> {
    Ok(Json(json!({
        "status": "not_implemented",
        "message": "Value computation will be implemented in Week 2-3"
    })))
}

/// Compute Market factor (placeholder)
pub async fn compute_market(_config: Json<FactorConfig>) -> Result<Json<Value>> {
    Ok(Json(json!({
        "status": "not_implemented",
        "message": "Market computation will be implemented in Week 2-3"
    })))
}

/// Compute Growth factor (placeholder)
pub async fn compute_growth(_config: Json<FactorConfig>) -> Result<Json<Value>> {
    Ok(Json(json!({
        "status": "not_implemented",
        "message": "Growth computation will be implemented in Week 2-3"
    })))
}
