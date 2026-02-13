// Library exports for testing and modular structure

pub mod api;
pub mod config;
pub mod data;
pub mod error;
pub mod factor;
pub mod logger;
pub mod models;
pub mod stats;

// Re-export commonly used types
pub use config::Config;
pub use error::{Error, Result};
