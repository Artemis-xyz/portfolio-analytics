# Quick Start Guide - Factors-rs

## Immediate Next Steps

### 1. Test the Server Locally (2 minutes)

```bash
cd factors-rs

# Run tests to verify everything works
cargo test

# Start the server
cargo run --release

# In another terminal, test the endpoints:
curl http://localhost:8000/health
curl http://localhost:8000/factors
curl http://localhost:8000/factors/compare
```

Expected: Server starts on port 8000, endpoints return JSON.

### 2. Deploy to Fly.io (10 minutes)

```bash
# Install flyctl (if not installed)
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch (interactive - follow prompts)
fly launch --name factors-rs-prod

# Set secrets
fly secrets set ARTEMIS_API_KEY="your_artemis_api_key_here"

# Deploy
fly deploy

# Get your URL
fly status
# Example: https://factors-rs-prod.fly.dev
```

### 3. Configure Supabase (2 minutes)

```bash
# Set the Rust server URL in Supabase
supabase secrets set FACTORS_API_URL=https://factors-rs-prod.fly.dev

# Redeploy Edge Functions to pick up the change
supabase functions deploy compute-portfolio-factors
supabase functions deploy get-factor-performance
```

**That's it!** Your Supabase Edge Functions now call the Rust server.

### 4. Verify Integration (1 minute)

Test that everything works end-to-end:

```bash
# Call Supabase Edge Function (update with your project URL)
curl -X POST https://rctyagxwbequikcdgkec.supabase.co/functions/v1/compute-portfolio-factors \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test", "holdings": []}'

# Check Rust server logs
fly logs
```

Expected: Supabase calls Rust server, Rust server logs show incoming request.

---

## Week 1 Summary

✅ **Status:** All read-only endpoints functional
✅ **Performance:** <50ms response time (estimated)
✅ **Tests:** 5/5 passing
✅ **Integration:** Zero Supabase code changes needed

---

## Week 2 Roadmap

**Objective:** Implement core FactorModel and data pipeline

**Tasks:**
1. Port Python `FactorModel` class to Rust (use Polars DataFrames)
2. Implement Artemis API client with parallel batch fetching
3. Implement Coinbase API client with concurrent requests
4. Build statistical functions (Sharpe, Sortino, cumulative returns)
5. Add 20+ unit tests

**Files to implement:**
- `src/factor/model.rs` - Core FactorModel struct
- `src/data/artemis.rs` - Artemis API client
- `src/data/coinbase.rs` - Coinbase API client
- `src/stats/returns.rs` - Return calculations
- `src/stats/risk.rs` - Risk metrics
- `src/stats/regression.rs` - OLS regression

**Reference:** See `factors/utils.py` for Python implementation to port.

---

## Common Commands

```bash
# Development
cargo check          # Fast compile check
cargo test           # Run all tests
cargo test --lib     # Run library tests only
cargo clippy         # Lint code
cargo fmt            # Format code

# Build
cargo build          # Debug build
cargo build --release # Optimized build

# Run
cargo run            # Run with debug
cargo run --release  # Run optimized

# Watch mode (requires cargo-watch)
cargo watch -x check # Auto-check on file changes
cargo watch -x test  # Auto-test on file changes

# Docker
docker build -t factors-rs .
docker run -p 8000:8000 --env-file .env factors-rs

# Benchmarks (Week 4)
cargo bench
```

---

## Troubleshooting

### Server won't start
```bash
# Check if port 8000 is in use
lsof -i :8000

# Try a different port
PORT=8001 cargo run --release
```

### Missing ARTEMIS_API_KEY
```bash
# Make sure .env file exists and has the key
cat .env | grep ARTEMIS_API_KEY

# Or set it directly
export ARTEMIS_API_KEY="your_key_here"
cargo run --release
```

### Tests failing
```bash
# Clean build and retry
cargo clean
cargo test

# Run with output
cargo test -- --nocapture
```

---

## Performance Monitoring

### Current (Week 1)
- Read-only endpoints: ~10-50ms
- CSV parsing: <10ms
- JSON serialization: <5ms

### Target (Week 4)
- Factor computation: 200-500ms
- **25-50x faster than Python**

### Measure
```bash
# Test response time
time curl http://localhost:8000/factors/compare

# Load test (Week 4)
wrk -t4 -c100 -d30s http://localhost:8000/factors/compare
```

---

## Next Session Goals

When you return to implement Week 2:

1. **Read Python implementation:** Review `factors/utils.py` to understand FactorModel
2. **Port FactorModel:** Translate Python pandas/numpy logic to Rust Polars
3. **Implement API clients:** Parallel fetching with tokio + reqwest
4. **Statistical functions:** Port calculations from Python (numpy → statrs/linfa)
5. **Test everything:** Compare Rust outputs with Python reference data

**Estimated time:** 2-3 sessions (5-10 hours)

---

## Resources

- **Polars docs:** https://pola-rs.github.io/polars/
- **Axum docs:** https://docs.rs/axum/latest/axum/
- **Tokio tutorial:** https://tokio.rs/tokio/tutorial
- **Python reference:** `factors/utils.py` and `factors/api.py`

---

## Questions?

Check the docs:
- `README.md` - Full project overview
- `DEPLOYMENT.md` - Production deployment
- `IMPLEMENTATION_STATUS.md` - Detailed progress report

---

**Week 1 Complete! Ready for Week 2.** 🚀
