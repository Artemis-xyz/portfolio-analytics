# Factor Models API

A FastAPI-based microservice for cryptocurrency factor model analysis and computation.

## 📖 Overview

This API provides endpoints for:
- Computing factor models (SMB, Momentum, Value, Growth, etc.)
- Retrieving historical factor performance
- Comparing factors across time
- Accessing factor time series data

Built using:
- **FastAPI** - Modern Python web framework
- **Pandas & NumPy** - Data processing
- **Artemis SDK** - Cryptocurrency data
- **yFinance** - Equity data (for future equity factor support)

## 🚀 Quick Start

See [QUICKSTART.md](./QUICKSTART.md) for deployment instructions.

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variable
export ARTEMIS_API_KEY="your-key-here"

# Run server
uvicorn api:app --reload

# API available at http://localhost:8000
# Interactive docs at http://localhost:8000/docs
```

### Docker

```bash
# Build
docker build -t factor-api .

# Run
docker run -p 8000:8000 -e ARTEMIS_API_KEY="your-key" factor-api

# Or use docker-compose
docker-compose up
```

## 📡 API Endpoints

### Health & Info
- `GET /` - API information
- `GET /health` - Health check
- `GET /factors` - List available factors

### Factor Data
- `GET /factors/{factor}/logs` - Historical performance logs
- `GET /factors/{factor}/latest` - Latest performance metrics
- `GET /factors/compare` - Compare all factors
- `GET /factors/time-series` - Time series data for factors

### Factor Computation
- `POST /compute/smb` - Compute SMB (Small Minus Big) factor
- `POST /compute/momentum` - Compute Momentum factor
- `POST /compute/equity-factors` - Compute equity factor analysis (MVP)

## 🧪 Example Usage

```bash
# Get latest momentum factor performance
curl http://localhost:8000/factors/momentum/latest

# Compare all factors
curl http://localhost:8000/factors/compare

# Get time series for multiple factors
curl "http://localhost:8000/factors/time-series?factors=smb,momentum,value&normalize_to_100=true"

# Compute new SMB factor model
curl -X POST http://localhost:8000/compute/smb \
  -H "Content-Type: application/json" \
  -d '{
    "factor": "smb",
    "breakpoint": 0.3,
    "min_assets": 30,
    "weighting_method": "equal",
    "start_date": "2023-01-01",
    "end_date": "2024-01-01",
    "market_cap_threshold": 100000000,
    "liquidity_threshold": 35000000,
    "min_lifetime_days": 30
  }'
```

## 📊 Available Factors

| Factor | Description | Signal |
|--------|-------------|--------|
| **smb** | Small Minus Big | Market cap (long small, short large) |
| **market** | Market Factor | Top 10 assets by market cap |
| **value** | Value Factor | MC/Fees ratio (long high, short low) |
| **momentum** | Momentum | Price momentum over lookback period |
| **momentum_v2** | Momentum V2 | Volatility-adjusted momentum |
| **growth** | Growth | Composite of fundamental metrics |

## 📁 Project Structure

```
factors/
├── api.py                  # FastAPI application
├── utils.py               # Factor computation utilities
├── Dockerfile             # Container definition
├── docker-compose.yml     # Local Docker setup
├── requirements.txt       # Python dependencies
├── railway.json          # Railway deployment config
├── build-and-push.sh     # Build & push script
├── factor_logs/          # Performance logs (gitignored)
├── QUICKSTART.md         # Quick deployment guide
├── DEPLOYMENT.md         # Detailed deployment docs
└── README.md            # This file
```

## 🔧 Configuration

### Environment Variables

Required:
- `ARTEMIS_API_KEY` - Your Artemis API key for crypto data

Optional:
- `PORT` - Server port (default: 8000, Railway sets automatically)

### CORS Configuration

Update allowed origins in `api.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-frontend.com",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 🚢 Deployment

### Railway (Recommended)

1. **GitHub Actions** (Automated):
   ```bash
   git push origin main
   # GitHub Actions builds and pushes to ghcr.io
   # Deploy to Railway using: ghcr.io/artemis-xyz/factor-api:latest
   ```

2. **Manual**:
   ```bash
   ./build-and-push.sh v1.0.0
   # Deploy to Railway using the pushed image
   ```

See [QUICKSTART.md](./QUICKSTART.md) for detailed steps.

### Other Platforms

This Dockerfile works with any platform that supports Docker:
- Render
- Fly.io
- Google Cloud Run
- AWS ECS/Fargate
- Azure Container Apps
- DigitalOcean App Platform

## 📈 Performance Metrics

The API computes and tracks:
- **Cumulative Returns** - Total return over period
- **Annualized Return** - Yearly return rate
- **Sharpe Ratio** - Risk-adjusted return
- **Sortino Ratio** - Downside risk-adjusted return
- **Long-Only Returns** - Long portfolio performance
- **Short-Only Returns** - Short portfolio performance

## 🔐 Security

- Non-root user in Docker container
- Health checks configured
- API key required for Artemis data access
- CORS restrictions in place

## 📝 Notebooks

The `factors/` directory includes Jupyter notebooks for research:
- `factor_models.ipynb` - Main factor analysis
- `momentum_factor.ipynb` - Momentum factor deep dive
- `factor_models_equities.ipynb` - Equity factors (experimental)

## 🧰 Development

### Install dependencies with uv (faster):
```bash
uv pip install -r requirements.txt
```

### Run tests (if added):
```bash
pytest tests/
```

### Format code:
```bash
black api.py utils.py
ruff check .
```

## 📚 API Documentation

Once running, visit:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI JSON**: `http://localhost:8000/openapi.json`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

[Add your license here]

## 🆘 Support

For issues or questions:
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed troubleshooting
- Review Railway logs for runtime errors
- Verify API key and environment variables
- Test locally with Docker first

## 🗺️ Roadmap

- [ ] Add more factor models (Carry, Quality, Low Volatility)
- [ ] Equity factor support (Fama-French)
- [ ] Real-time factor signals
- [ ] Portfolio optimization endpoints
- [ ] Backtesting framework
- [ ] WebSocket support for live updates
- [ ] Rate limiting and caching
- [ ] Comprehensive test suite
