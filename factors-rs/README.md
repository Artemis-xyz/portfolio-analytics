# Factors-rs: High-Performance Factor Model Analytics

Rust rewrite of the portfolio analytics factor models system, replacing Python with a high-performance Axum server.

**Target Performance:** 20-50x speedup (10s → 200-500ms)

## Features

- 🚀 **Blazing Fast**: 20-50x faster than Python implementation
- 📊 **6 Factor Models**: SMB, Market, Value, Momentum, Momentum V2, Growth
- 🔄 **Parallel Data Fetching**: Concurrent API requests with automatic rate limiting
- 📈 **Statistical Analysis**: Sharpe ratio, Sortino ratio, cumulative returns, volatility
- 🗂️ **CSV Logging**: Compatible with existing Python logs
- 🔌 **Drop-in Replacement**: Identical API contract to Python FastAPI

## Tech Stack

- **Web Framework**: Axum 0.7+ (tokio async runtime)
- **Data Processing**: Polars 0.36+ (20-100x faster than pandas)
- **Statistics**: statrs, linfa, ndarray-stats
- **HTTP Client**: reqwest with connection pooling
- **Serialization**: serde with zero-copy deserialization

## Getting Started

### Prerequisites

- Rust 1.75+ ([install](https://rustup.rs/))
- Artemis API key

### Installation

```bash
# Clone the repository
cd factors-rs

# Copy environment variables
cp .env.example .env

# Edit .env and add your ARTEMIS_API_KEY
nano .env

# Build the project
cargo build --release

# Run the server
cargo run --release
```

The server will start on `http://localhost:8000`.

### Development

```bash
# Run in development mode with auto-reload (requires cargo-watch)
cargo install cargo-watch
cargo watch -x run

# Run tests
cargo test

# Run benchmarks
cargo bench

# Check code formatting
cargo fmt --check

# Run clippy linter
cargo clippy -- -D warnings
```

## API Endpoints

### Query Endpoints (Week 1 - ✅ Implemented)

- `GET /` - API root and available endpoints
- `GET /health` - Health check
- `GET /factors` - List all available factors
- `GET /factors/{factor}/logs?limit=10` - Get historical performance logs
- `GET /factors/{factor}/latest` - Get latest performance metrics
- `GET /factors/compare` - Compare performance across all factors
- `GET /factors/time-series?factors=smb,momentum` - Get time series data

### Compute Endpoints (Week 2-3 - 🚧 In Progress)

- `POST /compute/smb` - Compute SMB factor
- `POST /compute/momentum` - Compute Momentum factor
- `POST /compute/value` - Compute Value factor
- `POST /compute/market` - Compute Market factor
- `POST /compute/growth` - Compute Growth factor

## Project Structure

```
factors-rs/
├── src/
│   ├── main.rs              # Axum server entry point
│   ├── config.rs            # Configuration from environment
│   ├── error.rs             # Error types and handling
│   ├── api/                 # REST API handlers
│   │   ├── factors.rs       # Factor query endpoints
│   │   ├── compute.rs       # Factor computation endpoints
│   │   └── health.rs        # Health check
│   ├── models/              # Data models (JSON schemas)
│   │   ├── config.rs        # FactorConfig
│   │   ├── performance.rs   # FactorPerformance
│   │   ├── portfolio.rs     # PortfolioComposition
│   │   └── time_series.rs   # TimeSeriesData
│   ├── factor/              # Core factor modeling logic
│   │   ├── model.rs         # FactorModel struct
│   │   ├── smb.rs           # SMB factor
│   │   ├── momentum.rs      # Momentum factors
│   │   ├── value.rs         # Value factor
│   │   ├── market.rs        # Market factor
│   │   └── growth.rs        # Growth factor
│   ├── data/                # External data sources
│   │   ├── artemis.rs       # Artemis API client
│   │   ├── coinbase.rs      # Coinbase API client
│   │   └── yahoo.rs         # Yahoo Finance API client
│   ├── stats/               # Statistical computations
│   │   ├── returns.rs       # Return calculations
│   │   ├── risk.rs          # Risk metrics
│   │   └── regression.rs    # OLS regression
│   └── logger/              # Results persistence
│       └── csv_logger.rs    # CSV log writer
├── tests/                   # Integration tests
└── benches/                 # Performance benchmarks
```

## Performance Benchmarks

Expected speedup breakdown by operation:

| Operation | Python Time | Rust Expected | Speedup |
|-----------|-------------|---------------|---------|
| CSV parsing | 500ms | 20ms | 25x |
| DataFrame operations | 3000ms | 150ms | 20x |
| Rolling windows | 2000ms | 80ms | 25x |
| Percentile sorting | 800ms | 30ms | 27x |
| OLS regression | 400ms | 50ms | 8x |
| JSON serialization | 200ms | 10ms | 20x |
| HTTP requests | 1000ms | 800ms | 1.25x |
| **Total end-to-end** | **~10s** | **~200-400ms** | **25-50x** |

## Implementation Timeline

- ✅ **Week 1 (Days 1-5)**: Foundation - Axum server, read-only endpoints, CSV logging
- 🚧 **Week 2 (Days 6-10)**: Core engine - FactorModel, API clients, statistics
- 🔜 **Week 3 (Days 11-15)**: Factor computation - All 6 factors implemented
- 🔜 **Week 4 (Days 16-20)**: Testing & cutover - Shadow mode, load testing, production deployment

## Deployment

### Docker

```bash
# Build Docker image
docker build -t factors-rs .

# Run container
docker run -p 8000:8000 --env-file .env factors-rs
```

### Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch --name factors-rs
fly secrets set ARTEMIS_API_KEY=your_key_here
fly deploy
```

## Testing

```bash
# Run all tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_factor_config_validation

# Run integration tests
cargo test --test api_tests
```

## Contributing

This is an internal rewrite project. See the plan document for implementation details.

## License

Proprietary - Artemis Portfolio Analytics
