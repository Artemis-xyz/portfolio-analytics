# Integration Testing Guide

This guide provides comprehensive integration tests for the Artemis API integration.

## Prerequisites

1. **Set up environment**:
   ```bash
   # Ensure .env file has ARTEMIS_API_KEY
   cat .env | grep ARTEMIS_API_KEY
   # Should show: ARTEMIS_API_KEY="your_key_here"
   ```

2. **Start local Supabase**:
   ```bash
   # Terminal 1: Start Supabase stack
   supabase start

   # Terminal 2: Serve the Edge Function
   supabase functions serve get-24h-prices --env-file .env
   ```

3. **Set base URL**:
   ```bash
   export FUNCTION_URL="http://localhost:54321/functions/v1/get-24h-prices"
   ```

## Test Suite

### Test 1: Single Crypto Ticker (Artemis)

**Purpose:** Verify basic Artemis API integration

```bash
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["BTC"], "range": "1d"}'
```

**Expected Output:**
```json
{
  "BTC": {
    "price": 43251.56,
    "change": 1205.34,
    "changePct": 2.87
  }
}
```

**Verify:**
- ✓ Response received within 2 seconds
- ✓ Price is reasonable (check against CoinMarketCap)
- ✓ Change and changePct are calculated correctly
- ✓ Logs show: "✓ Artemis client initialized"
- ✓ No fallback messages in logs

---

### Test 2: Multiple Crypto Tickers

**Purpose:** Verify batch processing with Artemis

```bash
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["BTC", "ETH", "SOL"], "range": "1d"}'
```

**Expected Output:**
```json
{
  "BTC": { "price": 43251.56, "change": 1205.34, "changePct": 2.87 },
  "ETH": { "price": 2543.12, "change": -45.67, "changePct": -1.76 },
  "SOL": { "price": 98.45, "change": 3.21, "changePct": 3.37 }
}
```

**Verify:**
- ✓ All three tickers returned
- ✓ Response within 3 seconds (batching adds slight delay)
- ✓ Logs show batch processing (1-second delay between batches)
- ✓ Cache statistics appear in logs

---

### Test 3: Mixed Portfolio (Crypto + Equity)

**Purpose:** Verify routing logic (crypto → Artemis, equity → Yahoo)

```bash
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["BTC", "ETH", "AAPL", "TSLA"], "range": "1d"}'
```

**Expected Output:**
```json
{
  "BTC": { "price": 43251.56, "change": 1205.34, "changePct": 2.87 },
  "ETH": { "price": 2543.12, "change": -45.67, "changePct": -1.76 },
  "AAPL": { "price": 178.32, "change": 2.14, "changePct": 1.21 },
  "TSLA": { "price": 234.56, "change": -5.43, "changePct": -2.26 }
}
```

**Verify:**
- ✓ Crypto tickers use Artemis (check logs)
- ✓ Equity tickers use Yahoo Finance (check logs)
- ✓ All tickers return valid data
- ✓ Response within 4 seconds

---

### Test 4: Different Timeframes

**Purpose:** Verify all supported time ranges work correctly

```bash
# 1 day
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["BTC"], "range": "1d"}'

# 5 days
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["BTC"], "range": "5d"}'

# 1 month
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["BTC"], "range": "1mo"}'

# 3 months
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["BTC"], "range": "3mo"}'

# 6 months
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["BTC"], "range": "6mo"}'

# Year-to-date
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["BTC"], "range": "ytd"}'
```

**Verify:**
- ✓ All ranges return valid data
- ✓ ChangePct varies appropriately by timeframe
- ✓ Longer ranges show more significant changes
- ✓ YTD calculates from Jan 1 of current year

---

### Test 5: Cache Behavior

**Purpose:** Verify caching reduces API calls

```bash
# First request (cache miss)
time curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["BTC"], "range": "1d"}'

# Second request (cache hit)
time curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["BTC"], "range": "1d"}'

# Check cache stats in logs
tail -n 50 /tmp/supabase/logs/functions.log | grep "Cache Statistics"
```

**Expected Behavior:**
- First request: ~2 seconds (API call)
- Second request: ~200ms (cached)
- Cache stats show: `hitRate: >50%`

**Verify:**
- ✓ Second request is significantly faster
- ✓ Cache hit rate increases with subsequent requests
- ✓ Logs show cache hits

---

### Test 6: Fallback to Coinbase

**Purpose:** Verify graceful degradation when Artemis fails

```bash
# Stop the function
# Edit index.ts: Comment out the Artemis API call to simulate failure

# Restart function
supabase functions serve get-24h-prices --env-file .env

# Test fallback
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["BTC"], "range": "1d"}'
```

**Expected Output:**
- Still returns valid BTC price
- Logs show: "Artemis failed for BTC, falling back to Coinbase"

**Verify:**
- ✓ Price is returned (from Coinbase)
- ✓ No errors thrown
- ✓ System continues working

**Cleanup:** Revert the code change and restart function

---

### Test 7: Missing API Key Fallback

**Purpose:** Verify system works without Artemis API key

```bash
# Temporarily remove API key
export ARTEMIS_API_KEY=""

# Restart function
supabase functions serve get-24h-prices

# Test without API key
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["BTC", "ETH"], "range": "1d"}'
```

**Expected Output:**
- Returns valid prices from Coinbase
- Logs show: "⚠ ARTEMIS_API_KEY not set - crypto prices will use Coinbase fallback"

**Verify:**
- ✓ System works without Artemis
- ✓ All crypto tickers return prices
- ✓ No errors thrown

**Cleanup:** Restore API key in .env and restart function

---

### Test 8: High Load (50 Tickers)

**Purpose:** Verify batch processing and rate limiting

```bash
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{
    "tickers": [
      "BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "DOT", "AVAX", "MATIC", "LINK",
      "UNI", "ATOM", "LTC", "BCH", "ALGO", "XLM", "FIL", "NEAR", "APT", "ARB",
      "OP", "SUI", "SEI", "TIA", "INJ", "FET", "RENDER", "ONDO", "PEPE", "SHIB",
      "HBAR", "ICP", "AAVE", "MKR", "COMP", "SNX", "GRT", "IMX", "BLUR", "WLD",
      "AAPL", "TSLA", "GOOGL", "MSFT", "AMZN", "META", "NVDA", "AMD", "NFLX", "DIS"
    ],
    "range": "1d"
  }'
```

**Expected Behavior:**
- Response within 10 seconds
- All tickers return data
- Logs show multiple batches processed
- 1-second delays between Artemis batches

**Verify:**
- ✓ All 50 tickers returned
- ✓ Crypto tickers use Artemis
- ✓ Equity tickers use Yahoo
- ✓ No timeouts or errors
- ✓ Batching evident in logs

---

### Test 9: Invalid Ticker Handling

**Purpose:** Verify graceful handling of invalid tickers

```bash
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["BTC", "INVALID_TICKER", "ETH"], "range": "1d"}'
```

**Expected Output:**
```json
{
  "BTC": { "price": 43251.56, "change": 1205.34, "changePct": 2.87 },
  "ETH": { "price": 2543.12, "change": -45.67, "changePct": -1.76 }
}
```

**Verify:**
- ✓ Valid tickers return data
- ✓ Invalid ticker omitted from response
- ✓ Logs show error for invalid ticker
- ✓ Function continues processing other tickers

---

### Test 10: CORS Headers

**Purpose:** Verify CORS headers are present for browser requests

```bash
curl -X OPTIONS $FUNCTION_URL \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

**Verify:**
- ✓ Response includes `Access-Control-Allow-Origin: *`
- ✓ Response includes `Access-Control-Allow-Headers`
- ✓ Status code: 200

---

## Automated Test Script

Save as `run_integration_tests.sh`:

```bash
#!/bin/bash

# Integration Test Suite for Artemis API Integration
# Usage: ./run_integration_tests.sh

set -e

FUNCTION_URL="http://localhost:54321/functions/v1/get-24h-prices"
PASSED=0
FAILED=0

echo "========================================="
echo "Integration Test Suite"
echo "========================================="
echo ""

# Helper function to run test
run_test() {
  local test_name="$1"
  local curl_cmd="$2"
  local expected_key="$3"

  echo "Running: $test_name"

  response=$(eval "$curl_cmd")

  if echo "$response" | grep -q "$expected_key"; then
    echo "✓ PASSED: $test_name"
    ((PASSED++))
  else
    echo "✗ FAILED: $test_name"
    echo "Response: $response"
    ((FAILED++))
  fi

  echo ""
}

# Test 1: Single crypto ticker
run_test "Single Crypto Ticker" \
  "curl -s -X POST $FUNCTION_URL -H 'Content-Type: application/json' -d '{\"tickers\": [\"BTC\"], \"range\": \"1d\"}'" \
  "price"

# Test 2: Multiple crypto tickers
run_test "Multiple Crypto Tickers" \
  "curl -s -X POST $FUNCTION_URL -H 'Content-Type: application/json' -d '{\"tickers\": [\"BTC\", \"ETH\", \"SOL\"], \"range\": \"1d\"}'" \
  "ETH"

# Test 3: Mixed portfolio
run_test "Mixed Crypto + Equity" \
  "curl -s -X POST $FUNCTION_URL -H 'Content-Type: application/json' -d '{\"tickers\": [\"BTC\", \"AAPL\"], \"range\": \"1d\"}'" \
  "AAPL"

# Test 4: Different timeframe
run_test "1-Month Timeframe" \
  "curl -s -X POST $FUNCTION_URL -H 'Content-Type: application/json' -d '{\"tickers\": [\"BTC\"], \"range\": \"1mo\"}'" \
  "changePct"

# Test 5: CORS
run_test "CORS Headers" \
  "curl -s -X OPTIONS $FUNCTION_URL -H 'Origin: http://localhost:3000'" \
  "Access-Control-Allow-Origin"

echo "========================================="
echo "Test Results"
echo "========================================="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✓ All tests passed!"
  exit 0
else
  echo "✗ Some tests failed"
  exit 1
fi
```

**Run the automated tests:**
```bash
chmod +x run_integration_tests.sh
./run_integration_tests.sh
```

---

## Manual Verification Checklist

After running integration tests, manually verify:

### Data Quality
- [ ] BTC price matches [CoinMarketCap](https://coinmarketcap.com)
- [ ] ETH price matches market data
- [ ] 24h change % is accurate
- [ ] Equity prices (AAPL) match Yahoo Finance

### Performance
- [ ] Initial request (cache miss): < 2 seconds
- [ ] Cached request: < 500ms
- [ ] 50-ticker request: < 10 seconds
- [ ] Cache hit rate > 80% after warmup

### System Behavior
- [ ] Artemis client initializes on startup
- [ ] Fallback to Coinbase works when Artemis fails
- [ ] System works without Artemis API key
- [ ] Invalid tickers don't crash the function
- [ ] CORS headers present for browser requests

### Logging
- [ ] Cache statistics appear every request
- [ ] Artemis API calls logged
- [ ] Fallback events logged
- [ ] Error messages are informative

---

## Troubleshooting Integration Tests

### Issue: "Connection refused"

**Solution:**
```bash
# Verify Supabase is running
supabase status

# Restart if needed
supabase stop
supabase start
```

### Issue: "Invalid API key"

**Solution:**
```bash
# Check .env file
cat .env | grep ARTEMIS_API_KEY

# Verify key format (should be alphanumeric string)
# Get new key from https://app.artemisanalytics.com if needed
```

### Issue: All tests timeout

**Solution:**
```bash
# Check function logs
supabase functions logs get-24h-prices

# Increase timeout in test requests
curl --max-time 30 ...
```

### Issue: Inconsistent results

**Solution:**
```bash
# Clear cache and retry
# In index.ts, temporarily call priceCache.clear()
# Or restart the function
```

---

## Next Steps

After all integration tests pass:

1. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: integrate Artemis API for crypto pricing"
   ```

2. **Deploy to production**
   - Follow DEPLOYMENT_GUIDE.md
   - Monitor for 24 hours
   - Update benchmarks

3. **Document findings**
   - Record actual response times
   - Note any symbol mapping issues
   - Update cache TTL if needed

---

**Last Updated:** 2026-02-13
**Test Suite Version:** 1.0
