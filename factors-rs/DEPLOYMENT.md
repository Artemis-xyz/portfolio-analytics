# Deployment Guide: Factors-rs

This guide covers deploying the Rust factors server and configuring Supabase to use it.

## Local Development

### 1. Start the Rust Server

```bash
cd factors-rs

# Create .env file (if not exists)
cp .env.example .env

# Edit .env and set ARTEMIS_API_KEY
nano .env

# Point to existing Python factor logs (optional)
# FACTOR_LOGS_DIR=../factors/factor_logs

# Start server
cargo run --release
```

Server runs on `http://localhost:8000`

### 2. Test Endpoints

```bash
# Health check
curl http://localhost:8000/health

# List factors
curl http://localhost:8000/factors

# Get factor comparison (requires existing logs)
curl http://localhost:8000/factors/compare
```

### 3. Configure Supabase (Local)

Supabase Edge Functions are already configured to use `FACTORS_API_URL` environment variable:

```typescript
const FACTORS_API_URL = Deno.env.get("FACTORS_API_URL") || "http://localhost:8000";
```

For local development, no changes needed - it defaults to localhost:8000.

## Production Deployment

### Option 1: Fly.io (Recommended)

**Advantages:**
- Auto-scaling
- Global CDN
- Built-in HTTPS
- $5-10/month for single instance

**Steps:**

```bash
cd factors-rs

# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch app (interactive)
fly launch --name factors-rs-prod

# Set environment variables
fly secrets set ARTEMIS_API_KEY="your_artemis_api_key_here"
fly secrets set FACTOR_LOGS_DIR="/app/factor_logs"

# Deploy
fly deploy

# Get the URL (e.g., https://factors-rs-prod.fly.dev)
fly status
```

### Option 2: Railway

```bash
# Install railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up

# Set environment variables in Railway dashboard
# ARTEMIS_API_KEY=your_key_here
# PORT=8000
# FACTOR_LOGS_DIR=/app/factor_logs

# Get deployment URL from Railway dashboard
```

### Option 3: Self-Hosted Docker

```bash
cd factors-rs

# Build image
docker build -t factors-rs:latest .

# Run container
docker run -d \
  -p 8000:8000 \
  -e ARTEMIS_API_KEY="your_key_here" \
  -e FACTOR_LOGS_DIR=/app/factor_logs \
  -v $(pwd)/factor_logs:/app/factor_logs \
  --name factors-rs \
  factors-rs:latest

# Check logs
docker logs -f factors-rs
```

## Configure Supabase to Use Rust Server

### Set Environment Variable

Once your Rust server is deployed, update the Supabase Edge Functions:

**Via Supabase Dashboard:**
1. Go to Project Settings → Edge Functions → Secrets
2. Add new secret:
   - Key: `FACTORS_API_URL`
   - Value: `https://your-rust-server-url.fly.dev` (or your deployment URL)

**Via Supabase CLI:**

```bash
# Set environment variable
supabase secrets set FACTORS_API_URL=https://factors-rs-prod.fly.dev

# Deploy edge functions to pick up new config
supabase functions deploy compute-portfolio-factors
supabase functions deploy get-factor-performance
```

### Verify Integration

Test that Supabase is calling the Rust server:

```bash
# Call Supabase Edge Function
curl -X POST https://rctyagxwbequikcdgkec.supabase.co/functions/v1/compute-portfolio-factors \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user",
    "holdings": []
  }'

# Check Rust server logs
# You should see incoming requests from Supabase
fly logs # (for Fly.io)
# or
docker logs -f factors-rs # (for Docker)
```

## Migration Strategy: Parallel Shadow Mode

Run both Python and Rust servers simultaneously for validation:

### Week 1: Rust Read-Only Mode

1. Deploy Rust server
2. Keep Python server running
3. Rust serves existing CSV logs (read-only)
4. Verify Rust endpoints return same data as Python

```bash
# Compare outputs
curl http://localhost:8000/factors/compare > rust-output.json
curl http://localhost:8002/factors/compare > python-output.json
diff rust-output.json python-output.json
```

### Week 2-3: Rust Compute Endpoints

1. Implement compute endpoints in Rust
2. Run both servers in parallel
3. Compare factor computation results
4. Validate <0.1% difference in metrics

### Week 4: Cutover

1. Update `FACTORS_API_URL` to point to Rust server
2. Monitor for 24 hours
3. Keep Python server running as fallback
4. After 30 days, decommission Python server

## Rollback Plan

If issues arise, instantly rollback by changing environment variable:

```bash
# Rollback to Python
supabase secrets set FACTORS_API_URL=https://your-python-server-url

# Redeploy edge functions
supabase functions deploy compute-portfolio-factors
supabase functions deploy get-factor-performance
```

## Monitoring

### Check Server Health

```bash
# Rust server
curl https://your-rust-server/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2024-01-15T10:30:00Z",
#   "api_key_configured": true
# }
```

### Monitor Logs

**Fly.io:**
```bash
fly logs --app factors-rs-prod
```

**Railway:**
```bash
railway logs
```

**Docker:**
```bash
docker logs -f factors-rs
```

### Performance Metrics

Monitor response times in Supabase Edge Function logs:

```bash
supabase functions logs compute-portfolio-factors
# Look for: "Successfully fetched crypto factors: X ms"
```

**Expected Performance:**
- Python: ~10,000ms (10 seconds)
- Rust: ~200-400ms (20-50x improvement)

## Troubleshooting

### Issue: Rust server returns "No logs found"

**Solution:** Ensure `FACTOR_LOGS_DIR` points to existing Python logs:

```bash
# In .env file
FACTOR_LOGS_DIR=../factors/factor_logs

# Or use absolute path
FACTOR_LOGS_DIR=/absolute/path/to/factors/factor_logs
```

### Issue: Supabase still calling Python server

**Solution:** Verify environment variable is set:

```bash
supabase secrets list | grep FACTORS_API_URL

# If not set:
supabase secrets set FACTORS_API_URL=https://your-rust-server
```

### Issue: CORS errors

**Solution:** Rust server CORS is configured to allow all origins. Check that:
1. Rust server is accessible from Supabase
2. HTTPS is configured (required for production)
3. No firewall blocking requests

### Issue: Slow response times

**Solution:** Check:
1. Rust server has sufficient CPU/memory
2. `FACTOR_LOGS_DIR` directory has proper permissions
3. CSV files are not corrupted
4. Network latency between Supabase and Rust server

## Next Steps

1. ✅ Week 1: Deploy Rust server, verify read-only endpoints
2. 🚧 Week 2: Implement core FactorModel and data fetching
3. 🔜 Week 3: Implement all 6 factor computation endpoints
4. 🔜 Week 4: Shadow mode testing, cutover to production

## Support

For issues or questions:
- Check logs: `fly logs` or `docker logs`
- Review this guide
- Verify environment variables are set correctly
