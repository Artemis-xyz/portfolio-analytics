/**
 * In-memory caching layer for Supabase Edge Functions
 *
 * Provides TTL-based caching to reduce API calls and improve response times.
 * Cache is shared across requests within the same Edge Function instance.
 */

export interface CacheEntry<T> {
  data: T;
  expiresAt: number; // Unix timestamp in milliseconds
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

/**
 * In-memory cache with TTL support
 *
 * Features:
 * - Automatic expiration based on TTL
 * - Type-safe get/set operations
 * - Cache statistics tracking
 * - Periodic cleanup of expired entries
 */
export class InMemoryCache {
  private cache: Map<string, CacheEntry<unknown>>;
  private hits: number;
  private misses: number;
  private cleanupIntervalId?: number;

  constructor(cleanupIntervalMs = 60000) {
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;

    // Automatically clean up expired entries every minute
    if (cleanupIntervalMs > 0) {
      this.cleanupIntervalId = setInterval(() => {
        this.cleanup();
      }, cleanupIntervalMs) as unknown as number;
    }
  }

  /**
   * Store a value in the cache with a TTL
   *
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttlMs - Time to live in milliseconds (default: 5 minutes)
   */
  set<T>(key: string, data: T, ttlMs = 300_000): void {
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * Retrieve a value from the cache
   *
   * @param key - Cache key
   * @returns Cached data if found and not expired, null otherwise
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data as T;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Remove all expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`Cache cleanup: removed ${removedCount} expired entries`);
    }

    return removedCount;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate,
    };
  }

  /**
   * Get all keys in the cache (useful for debugging)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Destroy the cache and stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
    this.clear();
  }
}

// ─── Global Cache Instances ───

/**
 * Cache for cryptocurrency price data from Artemis API
 * TTL: 5 minutes (balance between freshness and API costs)
 */
export const priceCache = new InMemoryCache();

/**
 * Cache for symbol mappings and metadata
 * TTL: 24 hours (rarely changes)
 */
export const symbolCache = new InMemoryCache();

// ─── Cache Key Builders ───

/**
 * Build a cache key for price data
 *
 * @param ticker - Ticker symbol (e.g., "BTC")
 * @param range - Time range (e.g., "1d", "1w")
 * @param source - Data source ("artemis", "coinbase", "yahoo")
 * @returns Cache key string
 */
export function buildPriceCacheKey(ticker: string, range: string, source: string): string {
  return `${source}:${ticker.toUpperCase()}:${range}`;
}

/**
 * Build a cache key for batch price data
 *
 * @param tickers - Array of ticker symbols
 * @param range - Time range
 * @param source - Data source
 * @returns Cache key string
 */
export function buildBatchPriceCacheKey(tickers: string[], range: string, source: string): string {
  const sortedTickers = tickers.map(t => t.toUpperCase()).sort().join(",");
  return `${source}:batch:${sortedTickers}:${range}`;
}

// ─── Cache Utilities ───

/**
 * Get or set a cache entry with a factory function
 *
 * @param cache - Cache instance to use
 * @param key - Cache key
 * @param factory - Function to generate the value if not cached
 * @param ttlMs - Time to live in milliseconds
 * @returns Cached or newly generated value
 */
export async function getOrSet<T>(
  cache: InMemoryCache,
  key: string,
  factory: () => Promise<T>,
  ttlMs?: number
): Promise<T> {
  // Check cache first
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Generate new value
  const value = await factory();

  // Store in cache
  cache.set(key, value, ttlMs);

  return value;
}

/**
 * Log cache statistics (useful for monitoring)
 */
export function logCacheStats(): void {
  const priceStats = priceCache.getStats();
  const symbolStats = symbolCache.getStats();

  console.log("=== Cache Statistics ===");
  console.log("Price Cache:", {
    hits: priceStats.hits,
    misses: priceStats.misses,
    hitRate: `${priceStats.hitRate.toFixed(2)}%`,
    size: priceStats.size,
  });
  console.log("Symbol Cache:", {
    hits: symbolStats.hits,
    misses: symbolStats.misses,
    hitRate: `${symbolStats.hitRate.toFixed(2)}%`,
    size: symbolStats.size,
  });
}
