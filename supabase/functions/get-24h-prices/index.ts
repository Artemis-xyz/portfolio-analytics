import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ArtemisClient, getArtemisSymbol } from "./artemis-client.ts";
import { priceCache, buildPriceCacheKey, logCacheStats } from "./cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PriceResult {
  price: number;
  change: number;
  changePct: number;
  timeSeries?: Array<{ date: string; price: number }>; // Historical prices for metrics calculation
}

// Initialize Artemis client (null if API key not set)
const ARTEMIS_API_KEY = Deno.env.get("ARTEMIS_API_KEY");
let artemisClient: ArtemisClient | null = null;

if (ARTEMIS_API_KEY) {
  artemisClient = new ArtemisClient({
    apiKey: ARTEMIS_API_KEY,
    maxSymbolsPerBatch: 5,
    batchDelayMs: 1000,
    maxRetries: 2,
    timeoutMs: 30000,
  });
  console.log("✓ Artemis client initialized");
} else {
  console.warn("⚠ ARTEMIS_API_KEY not set - crypto prices will use Coinbase fallback");
}

// Common crypto symbols — used to route to Coinbase instead of Yahoo Finance
const CRYPTO_SYMBOLS = new Set([
  "BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "DOT", "AVAX", "MATIC", "LINK",
  "UNI", "ATOM", "LTC", "BCH", "ALGO", "XLM", "FIL", "NEAR", "APT", "ARB",
  "OP", "SUI", "SEI", "TIA", "INJ", "FET", "RENDER", "ONDO", "PEPE", "SHIB",
  "HBAR", "VET", "ICP", "SAND", "MANA", "CRO", "EOS", "XTZ", "AAVE", "MKR",
  "COMP", "SNX", "GRT", "ENS", "IMX", "BLUR", "WLD", "JUP", "BONK", "WIF",
]);

function isCryptoTicker(ticker: string): boolean {
  const upper = ticker.toUpperCase();
  if (upper.endsWith("-USD") || upper.endsWith("-USDT")) {
    const base = upper.split("-")[0];
    return CRYPTO_SYMBOLS.has(base);
  }
  return CRYPTO_SYMBOLS.has(upper);
}

function getCryptoBase(ticker: string): string {
  const upper = ticker.toUpperCase();
  if (upper.includes("-")) return upper.split("-")[0];
  return upper;
}

// Valid Yahoo Finance ranges
const VALID_RANGES = new Set(["1d", "5d", "1mo", "3mo", "6mo", "ytd", "1y", "max"]);

// ─── Date Range Helpers ───

/**
 * Convert range string to number of days for Artemis API lookback
 */
function rangeToDays(range: string): number {
  const map: Record<string, number> = {
    "1d": 2,
    "5d": 6,
    "1mo": 31,
    "3mo": 91,
    "6mo": 182,
    "ytd": getYTDDays(),
    "1y": 366,
    "max": 730,
    "2d": 2, // Internal range
  };
  return map[range] || 2;
}

/**
 * Get number of days since start of current year
 */
function getYTDDays(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const diffMs = now.getTime() - startOfYear.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Subtract days from a date string
 */
function subtractDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

// ─── Artemis API (crypto prices) ───

/**
 * Fetch cryptocurrency price from Artemis API
 *
 * Uses the most recent data point as the current price and calculates
 * change from the start of the requested time range.
 */
async function fetchArtemisPrice(
  ticker: string,
  range: string,
  client: ArtemisClient
): Promise<PriceResult | null> {
  try {
    // Check cache first
    const cacheKey = buildPriceCacheKey(ticker, range, "artemis");
    const cached = priceCache.get<PriceResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // Calculate date range
    const endDate = new Date().toISOString().split("T")[0];
    const daysBack = rangeToDays(range);
    const startDate = subtractDays(endDate, daysBack);

    // Get Artemis symbol name (e.g., BTC -> bitcoin)
    const base = getCryptoBase(ticker);
    const artemisSymbol = getArtemisSymbol(base);

    // Fetch from Artemis API
    const response = await client.fetchMetrics({
      symbols: [artemisSymbol],
      metrics: ["price"],
      startDate,
      endDate,
    });

    // Extract price data
    const symbolData = response.data.symbols[artemisSymbol];
    if (!symbolData || !symbolData.price || symbolData.price.length < 2) {
      console.warn(`Insufficient Artemis data for ${ticker} (${artemisSymbol})`);
      return null;
    }

    const prices = symbolData.price;
    const currentPrice = prices[prices.length - 1].val;
    const startPrice = prices[0].val;

    if (!currentPrice || !startPrice) {
      return null;
    }

    const change = currentPrice - startPrice;
    const changePct = (change / startPrice) * 100;

    // Build time series from Artemis data
    const timeSeries = prices.map((p: any) => ({
      date: p.date,
      price: p.val,
    }));

    const result = { price: currentPrice, change, changePct, timeSeries };

    // Cache result for 5 minutes
    priceCache.set(cacheKey, result, 300_000);

    return result;
  } catch (err) {
    console.error(`Artemis fetch failed for ${ticker}:`, err);
    return null;
  }
}

// ─── Yahoo Finance (equities, ETFs, and fallback for crypto 24h change) ───
async function fetchYahooPrice(ticker: string, range = "2d"): Promise<PriceResult | null> {
  try {
    const interval = ["1d", "5d"].includes(range) ? "1d" : "1wk";
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PortfolioTracker/1.0)" },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Yahoo chart error for ${ticker}: ${res.status} - ${body.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const currentPrice = meta?.regularMarketPrice ?? 0;

    // For range-based lookback, use the first data point as the start price
    const closes = result.indicators?.quote?.[0]?.close;
    const opens = result.indicators?.quote?.[0]?.open;
    let startPrice: number;

    if (range === "2d" || range === "1d") {
      // For 1D, use chartPreviousClose
      startPrice = meta?.chartPreviousClose ?? meta?.previousClose ?? 0;
    } else if (closes && closes.length > 0) {
      // Use the first valid close/open as start price
      startPrice = closes[0] ?? opens?.[0] ?? meta?.chartPreviousClose ?? 0;
    } else {
      startPrice = meta?.chartPreviousClose ?? 0;
    }

    if (!currentPrice || !startPrice) return null;

    const change = currentPrice - startPrice;
    const changePct = startPrice > 0 ? (change / startPrice) * 100 : 0;

    // Build time series from Yahoo data
    const timestamps = result.timestamp || [];
    const timeSeries = closes
      .map((close: number | null, i: number) => {
        if (close !== null && timestamps[i]) {
          return {
            date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
            price: close,
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{ date: string; price: number }>;

    return { price: currentPrice, change, changePct, timeSeries };
  } catch (err) {
    console.error(`Failed to fetch ${ticker}:`, err);
    return null;
  }
}

// ─── Coinbase (crypto current price) + Yahoo (historical change) ───
async function fetchCryptoPrice(ticker: string, range = "2d"): Promise<PriceResult | null> {
  try {
    const base = getCryptoBase(ticker);
    // Fetch current spot price from Coinbase
    const spotRes = await fetch(`https://api.coinbase.com/v2/prices/${base}-USD/spot`, {
      headers: { "CB-VERSION": "2024-01-01" },
    });
    if (!spotRes.ok) {
      console.error(`Coinbase spot error for ${base}: ${spotRes.status}`);
      return null;
    }
    const spotData = await spotRes.json();
    const currentPrice = parseFloat(spotData?.data?.amount ?? "0");

    // Use Yahoo for historical change data and time series
    const yahooTicker = `${base}-USD`;
    const yahooData = await fetchYahooPrice(yahooTicker, range);
    if (yahooData) {
      const change = currentPrice * (yahooData.changePct / 100);
      // Scale the time series to current price
      const timeSeries = yahooData.timeSeries?.map((p) => ({
        date: p.date,
        price: currentPrice * (p.price / yahooData.price),
      }));
      return { price: currentPrice, change, changePct: yahooData.changePct, timeSeries };
    }

    return { price: currentPrice, change: 0, changePct: 0 };
  } catch (err) {
    console.error(`Failed to fetch crypto ${ticker}:`, err);
    return null;
  }
}

/**
 * Fetch price for a single ticker with fallback logic:
 * 1. For crypto: Try Artemis first, fallback to Coinbase+Yahoo
 * 2. For equities: Use Yahoo Finance directly
 */
async function fetchTickerPrice(
  ticker: string,
  range = "2d",
  artemisClient: ArtemisClient | null
): Promise<PriceResult | null> {
  // Crypto: Try Artemis first, fallback to Coinbase
  if (isCryptoTicker(ticker) && artemisClient) {
    const artemisResult = await fetchArtemisPrice(ticker, range, artemisClient);
    if (artemisResult) {
      return artemisResult;
    }

    // Fallback to Coinbase + Yahoo
    console.log(`Artemis failed for ${ticker}, falling back to Coinbase`);
    return fetchCryptoPrice(ticker, range);
  }

  // Crypto without Artemis client: Use Coinbase
  if (isCryptoTicker(ticker)) {
    return fetchCryptoPrice(ticker, range);
  }

  // Non-crypto: Use Yahoo Finance
  return fetchYahooPrice(ticker, range);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Note: Authentication check disabled temporarily until JWT is configured
    // Price data is not sensitive, so we allow anonymous access
    // const authHeader = req.headers.get("Authorization");
    // if (!authHeader) {
    //   return new Response(JSON.stringify({ error: "Not authenticated" }), {
    //     status: 401,
    //     headers: { ...corsHeaders, "Content-Type": "application/json" },
    //   });
    // }

    const body = await req.json();
    const { tickers, range: requestedRange } = body;
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate and map range
    const range = VALID_RANGES.has(requestedRange) ? requestedRange : "2d";

    const uniqueTickers = [...new Set(tickers.map((t: string) => t.toUpperCase()))].slice(0, 50);

    // Fetch all tickers in parallel with concurrency limit
    const batchSize = 10;
    const results: Record<string, PriceResult> = {};

    for (let i = 0; i < uniqueTickers.length; i += batchSize) {
      const batch = uniqueTickers.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (ticker) => {
          const data = await fetchTickerPrice(ticker, range, artemisClient);
          return { ticker, data };
        })
      );

      for (const { ticker, data } of batchResults) {
        if (data) results[ticker] = data;
      }
    }

    // Log cache statistics (useful for monitoring)
    if (uniqueTickers.length > 0) {
      logCacheStats();
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("get-24h-prices error:", msg);
    return new Response(JSON.stringify({}), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
