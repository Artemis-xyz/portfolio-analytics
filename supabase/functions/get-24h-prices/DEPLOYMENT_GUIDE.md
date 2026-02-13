# Deployment Guide: Artemis API Integration

This guide covers deploying the Artemis-integrated price fetching Edge Function to Supabase.

## Prerequisites

1. **Artemis API Key**
   - Sign up at [https://app.artemisanalytics.com](https://app.artemisanalytics.com)
   - Navigate to your account settings to generate an API key
   - Save the key securely

2. **Supabase CLI**
   ```bash
   npm install -g supabase
   supabase login
   ```

3. **Verify Project Link**
   ```bash
   supabase link --project-ref lltvysthcylswqcbohfi
   ```

## Local Development Setup

### 1. Configure Local Environment

Add your Artemis API key to `.env` in the project root:

```bash
# .env
ARTEMIS_API_KEY="your_artemis_api_key_here"
```

**Note:** The `.env` file is already in `.gitignore` to prevent committing secrets.

### 2. Start Supabase Locally

```bash
# Start local Supabase stack
supabase start

# In a separate terminal, serve the Edge Function
supabase functions serve get-24h-prices --env-file .env
```

The function will be available at: `http://localhost:54321/functions/v1/get-24h-prices`

### 3. Test Locally

```bash
# Test single crypto ticker with Artemis
curl -X POST http://localhost:54321/functions/v1/get-24h-prices \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["BTC"], "range": "1d"}'

# Expected response:
# {"BTC": {"price": 43000.00, "change": 1200.00, "changePct": 2.86}}

# Test mixed portfolio (crypto + equity)
curl -X POST http://localhost:54321/functions/v1/get-24h-prices \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["BTC", "ETH", "AAPL", "TSLA"], "range": "1d"}'

# Test without API key (should fallback to Coinbase)
unset ARTEMIS_API_KEY
supabase functions serve get-24h-prices
# Verify console shows: "⚠ ARTEMIS_API_KEY not set - crypto prices will use Coinbase fallback"
```

## Production Deployment

### 1. Set Production Secret

**Important:** Set the secret BEFORE deploying the function.

```bash
# Set the Artemis API key as a Supabase secret
supabase secrets set ARTEMIS_API_KEY=your_production_api_key_here

# Verify the secret was set
supabase secrets list
# Should show: ARTEMIS_API_KEY (set)
```

**Security Notes:**
- Never commit API keys to version control
- Use different keys for development and production if possible
- Rotate keys periodically
- Monitor API usage in Artemis dashboard

### 2. Deploy the Edge Function

```bash
# Deploy the function
supabase functions deploy get-24h-prices

# Verify deployment
supabase functions list
# Should show: get-24h-prices (deployed)
```

### 3. Monitor Deployment

```bash
# Watch real-time logs
supabase functions logs get-24h-prices --follow

# Check for initialization message
# ✓ Artemis client initialized

# Monitor cache statistics in logs
# === Cache Statistics ===
# Price Cache: { hits: 45, misses: 5, hitRate: 90.00%, size: 10 }
```

### 4. Test Production Endpoint

```bash
# Get your production URL
SUPABASE_URL="https://lltvysthcylswqcbohfi.supabase.co"

# Test crypto price
curl -X POST "${SUPABASE_URL}/functions/v1/get-24h-prices" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d '{"tickers": ["BTC", "ETH"], "range": "1d"}'

# Verify response contains valid prices
```

## Verification Checklist

After deployment, verify:

- [ ] **Artemis Integration Working**
  - Check logs for "✓ Artemis client initialized"
  - Test crypto ticker returns valid price
  - No "ARTEMIS_API_KEY not set" warnings

- [ ] **Fallback Working**
  - Temporarily remove API key: `supabase secrets unset ARTEMIS_API_KEY`
  - Verify crypto prices still work (using Coinbase fallback)
  - Restore API key: `supabase secrets set ARTEMIS_API_KEY=...`

- [ ] **Cache Performance**
  - Check cache hit rate > 80% after warmup (5-10 requests)
  - Verify cache statistics in logs

- [ ] **Response Times**
  - Initial request: < 2 seconds (cache miss)
  - Cached request: < 500ms (cache hit)

- [ ] **Data Quality**
  - BTC price matches current market price (check CoinMarketCap)
  - 24h change percentage is accurate
  - Equity tickers (AAPL, TSLA) still work

## Monitoring & Maintenance

### Daily Monitoring

```bash
# Check error rate
supabase functions logs get-24h-prices --limit 100 | grep -i error

# Monitor Artemis fallback usage (should be < 5%)
supabase functions logs get-24h-prices --limit 100 | grep "falling back to Coinbase"

# Check cache performance
supabase functions logs get-24h-prices --limit 100 | grep "Cache Statistics"
```

### Artemis API Usage

1. **Check Usage Dashboard**
   - Login to [https://app.artemisanalytics.com](https://app.artemisanalytics.com)
   - Navigate to Account → API Usage
   - Monitor:
     - Daily API calls
     - Rate limit status
     - Cost per day

2. **Set Usage Alerts**
   - Configure alerts for 80% of quota usage
   - Set budget limits if applicable

3. **Optimize API Calls**
   - Current caching: 5-minute TTL
   - To reduce costs, increase TTL: Edit `cache.ts` line `priceCache.set(key, result, 300_000)` → `600_000` (10 minutes)
   - Monitor impact on data freshness

## Troubleshooting

### Issue: "Artemis API error: 401"

**Cause:** Invalid or expired API key

**Solution:**
```bash
# Verify secret is set correctly
supabase secrets list

# Update the secret
supabase secrets set ARTEMIS_API_KEY=your_new_api_key

# Redeploy function
supabase functions deploy get-24h-prices
```

### Issue: "Insufficient Artemis data for BTC"

**Cause:** Symbol mapping issue or data not available for date range

**Solution:**
1. Check symbol mapping in `artemis-client.ts` (`TICKER_TO_ARTEMIS_MAP`)
2. Add missing mapping if needed
3. Check Artemis data availability for that asset
4. System will automatically fallback to Coinbase

### Issue: "Artemis fetch failed... falling back to Coinbase"

**Cause:** Network timeout or Artemis API downtime

**Solution:**
- This is expected behavior (fallback working)
- If frequent (> 10% of requests), investigate:
  ```bash
  # Check timeout setting in index.ts
  # Increase if needed: timeoutMs: 30000 → 60000
  ```

### Issue: Cache hit rate < 50%

**Cause:** Low request volume or frequent cache evictions

**Solution:**
1. Verify cache TTL is appropriate (5 minutes default)
2. Check if cache is being cleared: `supabase functions logs | grep "Cache cleanup"`
3. Consider increasing TTL if data freshness allows

### Issue: Response times > 3 seconds

**Cause:** Multiple Artemis API calls or cache misses

**Solution:**
1. Check batching is working: `supabase functions logs | grep "batch"`
2. Verify cache is enabled and hitting
3. Consider pre-warming cache for common tickers
4. Check Artemis API latency in logs

## Rollback Procedure

If issues arise after deployment:

### Option 1: Disable Artemis (Quick)

```bash
# Remove API key to fallback to Coinbase
supabase secrets unset ARTEMIS_API_KEY

# System automatically falls back to Coinbase/Yahoo
# No redeployment needed
```

### Option 2: Redeploy Previous Version

```bash
# Find previous commit
git log --oneline

# Checkout previous version
git checkout <previous-commit-hash>

# Redeploy
supabase functions deploy get-24h-prices

# Return to latest
git checkout main
```

## Performance Benchmarks

| Metric | Target | Measured |
|--------|--------|----------|
| Response time (cached) | < 500ms | _TBD_ |
| Response time (uncached) | < 2s | _TBD_ |
| Cache hit rate | > 80% | _TBD_ |
| Artemis fallback rate | < 5% | _TBD_ |
| Error rate | < 1% | _TBD_ |

Update these benchmarks after 24 hours of production traffic.

## Next Steps

After successful deployment:

1. **Monitor for 24 hours** - Track errors, fallbacks, and cache performance
2. **Update benchmarks** - Record actual performance metrics
3. **Optimize cache TTL** - Adjust based on cost vs freshness tradeoffs
4. **Document edge cases** - Note any symbol mappings that need adjustment
5. **Set up alerts** - Configure monitoring for API quota and error rates

## Support Resources

- **Artemis API Docs:** [https://app.artemisanalytics.com/docs](https://app.artemisanalytics.com/docs)
- **Supabase Edge Functions:** [https://supabase.com/docs/guides/functions](https://supabase.com/docs/guides/functions)
- **Project Issues:** Create an issue in the repository with deployment logs

---

**Deployed by:** [Your Name]
**Deployment Date:** [Date]
**Artemis API Key Created:** [Date]
**Last Updated:** 2026-02-13
