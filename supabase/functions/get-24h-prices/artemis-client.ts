/**
 * TypeScript client for Artemis REST API
 *
 * Provides methods to fetch cryptocurrency metrics from Artemis data platform.
 * Implements rate limiting, batching, and error handling with retries.
 *
 * @see https://app.artemisanalytics.com/docs
 */

// ─── Type Definitions ───

export interface ArtemisMetricValue {
  date: string;  // YYYY-MM-DD format
  val: number;   // Numeric value
}

export interface ArtemisSymbolData {
  [metricName: string]: ArtemisMetricValue[];
}

export interface ArtemisResponse {
  data: {
    symbols: {
      [symbol: string]: ArtemisSymbolData;
    };
  };
}

export interface FetchMetricsOptions {
  symbols: string[];       // e.g., ["btc", "eth", "sol"]
  metrics: string[];       // e.g., ["price", "mc", "24h_volume"]
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD
}

export interface ArtemisClientConfig {
  apiKey: string;
  baseUrl?: string;
  maxSymbolsPerBatch?: number;
  batchDelayMs?: number;
  maxRetries?: number;
  timeoutMs?: number;
}

// ─── Artemis Client ───

export class ArtemisClient {
  private apiKey: string;
  private baseUrl: string;
  private maxSymbolsPerBatch: number;
  private batchDelayMs: number;
  private maxRetries: number;
  private timeoutMs: number;

  constructor(config: ArtemisClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://data-svc.artemisxyz.com";
    this.maxSymbolsPerBatch = config.maxSymbolsPerBatch || 5;
    this.batchDelayMs = config.batchDelayMs || 1000;
    this.maxRetries = config.maxRetries || 2;
    this.timeoutMs = config.timeoutMs || 30000;
  }

  /**
   * Fetch metrics for multiple symbols with automatic batching
   *
   * @param options - Fetch options with symbols, metrics, and date range
   * @returns Aggregated response with all symbol data
   */
  async fetchMetrics(options: FetchMetricsOptions): Promise<ArtemisResponse> {
    const { symbols, metrics, startDate, endDate } = options;

    // Validate inputs
    if (symbols.length === 0) {
      throw new Error("At least one symbol is required");
    }
    if (metrics.length === 0) {
      throw new Error("At least one metric is required");
    }

    // Convert symbols to lowercase (Artemis requires lowercase)
    const lowercaseSymbols = symbols.map(s => s.toLowerCase());

    // Batch symbols to respect rate limits
    const batches = this.createBatches(lowercaseSymbols, this.maxSymbolsPerBatch);
    const results: ArtemisResponse = { data: { symbols: {} } };

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      try {
        const batchResult = await this.fetchBatch(batch, metrics, startDate, endDate);

        // Merge batch results
        Object.assign(results.data.symbols, batchResult.data.symbols);

        // Add delay between batches (except for the last batch)
        if (i < batches.length - 1) {
          await this.delay(this.batchDelayMs);
        }
      } catch (error) {
        console.error(`Failed to fetch batch ${i + 1}/${batches.length}:`, error);
        // Continue with remaining batches instead of failing completely
      }
    }

    return results;
  }

  /**
   * Fetch metrics for a single batch of symbols (private method)
   */
  private async fetchBatch(
    symbols: string[],
    metrics: string[],
    startDate: string,
    endDate: string
  ): Promise<ArtemisResponse> {
    const metricNames = metrics.join(",");
    const symbolList = symbols.join(",");

    const url = new URL(`${this.baseUrl}/data/api/${metricNames}/`);
    url.searchParams.set("symbols", symbolList);
    url.searchParams.set("startDate", startDate);
    url.searchParams.set("endDate", endDate);
    url.searchParams.set("APIKey", this.apiKey);

    return await this.fetchWithRetry(url.toString());
  }

  /**
   * Fetch with exponential backoff retry logic
   */
  private async fetchWithRetry(url: string): Promise<ArtemisResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Artemis API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data as ArtemisResponse;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Artemis API attempt ${attempt + 1}/${this.maxRetries + 1} failed:`, lastError.message);

        // Don't retry on the last attempt
        if (attempt < this.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const backoffMs = Math.pow(2, attempt) * 1000;
          await this.delay(backoffMs);
        }
      }
    }

    throw lastError || new Error("Artemis API request failed after retries");
  }

  /**
   * Create batches of symbols respecting the max batch size
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ─── Helper Functions ───

/**
 * Map uppercase ticker symbols to lowercase Artemis symbols
 *
 * @example
 * mapTickerToArtemisSymbol("BTC") => "btc"
 * mapTickerToArtemisSymbol("BTC-USD") => "btc"
 */
export function mapTickerToArtemisSymbol(ticker: string): string {
  const upper = ticker.toUpperCase();
  const base = upper.split("-")[0]; // Remove -USD suffix if present
  return base.toLowerCase();
}

/**
 * Mapping from common crypto tickers to Artemis symbol names
 * Based on ARTEMIS_TO_COINBASE_MAP from Python code
 */
export const TICKER_TO_ARTEMIS_MAP: Record<string, string> = {
  "BTC": "bitcoin",
  "ETH": "ethereum",
  "SOL": "solana",
  "XRP": "xrp",
  "ADA": "cardano",
  "DOGE": "dogecoin",
  "DOT": "polkadot",
  "AVAX": "avalanche",
  "MATIC": "polygon",
  "LINK": "chainlink",
  "UNI": "uniswap",
  "ATOM": "cosmos",
  "LTC": "litecoin",
  "BCH": "bitcoin-cash",
  "ALGO": "algorand",
  "XLM": "stellar",
  "FIL": "filecoin",
  "NEAR": "near",
  "APT": "aptos",
  "ARB": "arbitrum",
  "OP": "optimism",
  "SUI": "sui",
  "SEI": "sei",
  "TIA": "celestia",
  "INJ": "injective",
  "FET": "fetch-ai",
  "RENDER": "render",
  "ONDO": "ondo-finance",
  "PEPE": "pepe",
  "SHIB": "shiba-inu",
  "HBAR": "hedera",
  "ICP": "internet-computer",
  "SAND": "the-sandbox",
  "MANA": "decentraland",
  "AAVE": "aave",
  "MKR": "maker",
  "COMP": "compound",
  "SNX": "synthetix",
  "GRT": "the-graph",
  "IMX": "immutable-x",
  "BLUR": "blur",
  "WLD": "worldcoin",
  "JUP": "jupiter",
  "BONK": "bonk",
  "EOS": "eos",
  "XTZ": "tezos",
};

/**
 * Get Artemis symbol name from ticker
 * Falls back to lowercase ticker if no mapping exists
 */
export function getArtemisSymbol(ticker: string): string {
  const base = ticker.toUpperCase().split("-")[0];
  return TICKER_TO_ARTEMIS_MAP[base] || base.toLowerCase();
}
