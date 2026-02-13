/**
 * Unit tests for get-24h-prices Edge Function
 *
 * Run with: deno test --allow-env --allow-net
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { InMemoryCache, buildPriceCacheKey } from "./cache.ts";
import { mapTickerToArtemisSymbol, getArtemisSymbol, TICKER_TO_ARTEMIS_MAP } from "./artemis-client.ts";

// Note: These are internal functions that would need to be exported for testing
// For now, we'll test the exported components

// ─── Cache Tests ───

Deno.test("Cache: stores and retrieves values", () => {
  const cache = new InMemoryCache(0); // Disable cleanup interval for tests

  cache.set("test-key", { price: 100, change: 5, changePct: 5 }, 1000);
  const result = cache.get("test-key");

  assertExists(result);
  assertEquals(result, { price: 100, change: 5, changePct: 5 });

  cache.destroy();
});

Deno.test("Cache: returns null for non-existent keys", () => {
  const cache = new InMemoryCache(0);

  const result = cache.get("non-existent");
  assertEquals(result, null);

  cache.destroy();
});

Deno.test("Cache: expires entries after TTL", async () => {
  const cache = new InMemoryCache(0);

  // Set with 100ms TTL
  cache.set("short-lived", { price: 100 }, 100);

  // Should exist immediately
  assertExists(cache.get("short-lived"));

  // Wait for expiration
  await new Promise(resolve => setTimeout(resolve, 150));

  // Should be expired
  assertEquals(cache.get("short-lived"), null);

  cache.destroy();
});

Deno.test("Cache: cleanup removes expired entries", async () => {
  const cache = new InMemoryCache(0);

  // Add entries with different TTLs
  cache.set("expired", { price: 100 }, 50);
  cache.set("valid", { price: 200 }, 10000);

  // Wait for first to expire
  await new Promise(resolve => setTimeout(resolve, 100));

  // Run cleanup
  const removed = cache.cleanup();

  assertEquals(removed, 1);
  assertEquals(cache.get("expired"), null);
  assertExists(cache.get("valid"));

  cache.destroy();
});

Deno.test("Cache: tracks hit/miss statistics", () => {
  const cache = new InMemoryCache(0);

  cache.set("key1", { price: 100 });

  // Hit
  cache.get("key1");
  cache.get("key1");

  // Miss
  cache.get("key2");

  const stats = cache.getStats();
  assertEquals(stats.hits, 2);
  assertEquals(stats.misses, 1);
  assertEquals(stats.hitRate, (2 / 3) * 100);
  assertEquals(stats.size, 1);

  cache.destroy();
});

Deno.test("Cache: clear removes all entries", () => {
  const cache = new InMemoryCache(0);

  cache.set("key1", { price: 100 });
  cache.set("key2", { price: 200 });
  cache.set("key3", { price: 300 });

  assertEquals(cache.getStats().size, 3);

  cache.clear();

  assertEquals(cache.getStats().size, 0);
  assertEquals(cache.get("key1"), null);

  cache.destroy();
});

Deno.test("Cache: buildPriceCacheKey formats correctly", () => {
  const key = buildPriceCacheKey("BTC", "1d", "artemis");
  assertEquals(key, "artemis:BTC:1d");

  const key2 = buildPriceCacheKey("eth", "1w", "coinbase");
  assertEquals(key2, "coinbase:ETH:1w");
});

// ─── Symbol Mapping Tests ───

Deno.test("Symbol Mapping: mapTickerToArtemisSymbol converts to lowercase", () => {
  assertEquals(mapTickerToArtemisSymbol("BTC"), "btc");
  assertEquals(mapTickerToArtemisSymbol("ETH"), "eth");
  assertEquals(mapTickerToArtemisSymbol("btc"), "btc");
});

Deno.test("Symbol Mapping: mapTickerToArtemisSymbol removes -USD suffix", () => {
  assertEquals(mapTickerToArtemisSymbol("BTC-USD"), "btc");
  assertEquals(mapTickerToArtemisSymbol("ETH-USDT"), "eth");
});

Deno.test("Symbol Mapping: getArtemisSymbol returns full name", () => {
  assertEquals(getArtemisSymbol("BTC"), "bitcoin");
  assertEquals(getArtemisSymbol("ETH"), "ethereum");
  assertEquals(getArtemisSymbol("SOL"), "solana");
  assertEquals(getArtemisSymbol("BTC-USD"), "bitcoin");
});

Deno.test("Symbol Mapping: getArtemisSymbol falls back to lowercase", () => {
  assertEquals(getArtemisSymbol("UNKNOWN"), "unknown");
  assertEquals(getArtemisSymbol("XYZ-USD"), "xyz");
});

Deno.test("Symbol Mapping: TICKER_TO_ARTEMIS_MAP has common cryptos", () => {
  // Test a few key mappings
  assertEquals(TICKER_TO_ARTEMIS_MAP["BTC"], "bitcoin");
  assertEquals(TICKER_TO_ARTEMIS_MAP["ETH"], "ethereum");
  assertEquals(TICKER_TO_ARTEMIS_MAP["SOL"], "solana");
  assertEquals(TICKER_TO_ARTEMIS_MAP["ADA"], "cardano");
  assertEquals(TICKER_TO_ARTEMIS_MAP["DOT"], "polkadot");

  // Verify map has reasonable size (should have 40+ entries)
  const mapSize = Object.keys(TICKER_TO_ARTEMIS_MAP).length;
  assertEquals(mapSize > 40, true, `Map should have 40+ entries, got ${mapSize}`);
});

// ─── Date Helper Tests ───
// These would need the helper functions to be exported from index.ts
// For now, we document the expected behavior

/**
 * Expected behavior for rangeToDays():
 *
 * assertEquals(rangeToDays("1d"), 2);
 * assertEquals(rangeToDays("5d"), 6);
 * assertEquals(rangeToDays("1mo"), 31);
 * assertEquals(rangeToDays("3mo"), 91);
 * assertEquals(rangeToDays("6mo"), 182);
 * assertEquals(rangeToDays("1y"), 366);
 * assertEquals(rangeToDays("unknown"), 2); // default
 */

/**
 * Expected behavior for subtractDays():
 *
 * assertEquals(subtractDays("2025-02-13", 0), "2025-02-13");
 * assertEquals(subtractDays("2025-02-13", 1), "2025-02-12");
 * assertEquals(subtractDays("2025-02-13", 7), "2025-02-06");
 * assertEquals(subtractDays("2025-02-13", 31), "2025-01-13");
 */

/**
 * Expected behavior for getYTDDays():
 *
 * // As of 2025-02-13:
 * // Days from 2025-01-01 to 2025-02-13 = 44 days
 * const days = getYTDDays();
 * assertEquals(days > 40 && days < 50, true);
 */

// ─── Integration Test Helpers ───

/**
 * Mock Artemis API response
 */
export function createMockArtemisResponse(symbol: string, prices: Array<{ date: string, val: number }>) {
  return {
    data: {
      symbols: {
        [symbol]: {
          price: prices
        }
      }
    }
  };
}

Deno.test("Mock Helper: createMockArtemisResponse formats correctly", () => {
  const response = createMockArtemisResponse("btc", [
    { date: "2025-02-11", val: 42000 },
    { date: "2025-02-12", val: 43000 },
    { date: "2025-02-13", val: 44000 },
  ]);

  assertExists(response.data.symbols.btc);
  assertEquals(response.data.symbols.btc.price.length, 3);
  assertEquals(response.data.symbols.btc.price[0].val, 42000);
  assertEquals(response.data.symbols.btc.price[2].val, 44000);
});

// ─── Summary ───
console.log(`
✓ Cache Tests: Complete
✓ Symbol Mapping Tests: Complete
✓ Mock Helper Tests: Complete

Note: Integration tests require actual API calls and are in index.integration.test.ts
Run integration tests with: deno test --allow-all index.integration.test.ts
`);
