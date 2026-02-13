/**
 * Asset Type Normalization Utilities (Backend version for Supabase Edge Functions)
 *
 * Handles inconsistent asset type values across different data sources
 * (e.g., Stock/equity/Equity → EQUITY, Crypto/crypto/cryptocurrency → CRYPTO)
 */

export enum AssetCategory {
  CRYPTO = 'CRYPTO',
  EQUITY = 'EQUITY',
  ETF = 'ETF',
  FIXED_INCOME = 'FIXED_INCOME',
  OTHER = 'OTHER'
}

/**
 * Mapping of various asset type strings to normalized categories
 */
const ASSET_TYPE_MAP: Record<string, AssetCategory> = {
  // Crypto variations
  'crypto': AssetCategory.CRYPTO,
  'cryptocurrency': AssetCategory.CRYPTO,
  'digital asset': AssetCategory.CRYPTO,
  'token': AssetCategory.CRYPTO,
  'coin': AssetCategory.CRYPTO,

  // Equity variations
  'stock': AssetCategory.EQUITY,
  'equity': AssetCategory.EQUITY,
  'equities': AssetCategory.EQUITY,
  'share': AssetCategory.EQUITY,
  'shares': AssetCategory.EQUITY,
  'common stock': AssetCategory.EQUITY,

  // ETF variations
  'etf': AssetCategory.ETF,
  'exchange-traded fund': AssetCategory.ETF,
  'fund': AssetCategory.ETF,

  // Fixed income variations
  'bond': AssetCategory.FIXED_INCOME,
  'bonds': AssetCategory.FIXED_INCOME,
  'fixed income': AssetCategory.FIXED_INCOME,
  'treasury': AssetCategory.FIXED_INCOME,
  'corporate bond': AssetCategory.FIXED_INCOME,
};

/**
 * Normalizes an asset type string to a standard category
 *
 * @param assetType - The asset type string to normalize
 * @returns The normalized AssetCategory
 */
export function normalizeAssetType(assetType: string | null | undefined): AssetCategory {
  if (!assetType) return AssetCategory.OTHER;

  const normalized = assetType.toLowerCase().trim();
  return ASSET_TYPE_MAP[normalized] || AssetCategory.OTHER;
}

/**
 * Filters and categorizes holdings by asset type
 *
 * @param holdings - Array of holdings with asset_type and value fields
 * @returns Categorized holdings and statistics
 */
export function filterHoldingsByCategory<T extends { asset_type: string | null; value: number }>(
  holdings: T[]
) {
  const withCategories = holdings.map(h => ({
    ...h,
    asset_category: normalizeAssetType(h.asset_type),
  }));

  const crypto = withCategories.filter(h => h.asset_category === AssetCategory.CRYPTO);
  const equity = withCategories.filter(
    h => h.asset_category === AssetCategory.EQUITY || h.asset_category === AssetCategory.ETF
  );
  const fixedIncome = withCategories.filter(h => h.asset_category === AssetCategory.FIXED_INCOME);
  const other = withCategories.filter(h => h.asset_category === AssetCategory.OTHER);

  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
  const cryptoValue = crypto.reduce((sum, h) => sum + h.value, 0);
  const equityValue = equity.reduce((sum, h) => sum + h.value, 0);
  const fixedIncomeValue = fixedIncome.reduce((sum, h) => sum + h.value, 0);
  const otherValue = other.reduce((sum, h) => sum + h.value, 0);

  return {
    crypto,
    equity,
    fixedIncome,
    other,
    all: withCategories,
    stats: {
      totalValue,
      cryptoValue,
      equityValue,
      fixedIncomeValue,
      otherValue,
      cryptoPercent: totalValue > 0 ? (cryptoValue / totalValue) * 100 : 0,
      equityPercent: totalValue > 0 ? (equityValue / totalValue) * 100 : 0,
      fixedIncomePercent: totalValue > 0 ? (fixedIncomeValue / totalValue) * 100 : 0,
      otherPercent: totalValue > 0 ? (otherValue / totalValue) * 100 : 0,
      cryptoCount: crypto.length,
      equityCount: equity.length,
      fixedIncomeCount: fixedIncome.length,
      otherCount: other.length,
    },
  };
}

/**
 * Determines if a portfolio is crypto-heavy (>50% crypto allocation)
 *
 * @param holdings - Array of holdings
 * @returns True if portfolio has >50% crypto allocation
 */
export function isCryptoHeavyPortfolio<T extends { asset_type: string | null; value: number }>(
  holdings: T[]
): boolean {
  const filtered = filterHoldingsByCategory(holdings);
  return filtered.stats.cryptoPercent > 50;
}

/**
 * Gets the dominant asset category for a portfolio
 *
 * @param holdings - Array of holdings
 * @returns The dominant AssetCategory
 */
export function getDominantCategory<T extends { asset_type: string | null; value: number }>(
  holdings: T[]
): AssetCategory {
  const filtered = filterHoldingsByCategory(holdings);
  const { stats } = filtered;

  const categoryValues = [
    { category: AssetCategory.CRYPTO, percent: stats.cryptoPercent },
    { category: AssetCategory.EQUITY, percent: stats.equityPercent },
    { category: AssetCategory.FIXED_INCOME, percent: stats.fixedIncomePercent },
    { category: AssetCategory.OTHER, percent: stats.otherPercent },
  ];

  return categoryValues.sort((a, b) => b.percent - a.percent)[0].category;
}

/**
 * Common crypto ticker symbols
 */
const CRYPTO_TICKERS = new Set([
  'BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'UNI', 'AAVE',
  'XRP', 'LTC', 'BCH', 'DOGE', 'SHIB', 'ATOM', 'ALGO', 'XLM', 'VET', 'FIL',
  'TRX', 'ETC', 'XMR', 'NEAR', 'APT', 'SUI', 'ARB', 'OP', 'INJ', 'SEI',
  'PEPE', 'WIF', 'BONK', 'JTO', 'PYTH', 'JUP', 'WLD', 'TIA', 'DYM', 'STRK'
]);

/**
 * Common ETF ticker patterns
 */
const ETF_PATTERNS = [
  /^SPY$/i, /^QQQ$/i, /^IWM$/i, /^DIA$/i, /^VTI$/i, /^VOO$/i, /^VEA$/i,
  /^VWO$/i, /^AGG$/i, /^BND$/i, /^TLT$/i, /^GLD$/i, /^SLV$/i, /^USO$/i,
  /^ARKK$/i, /^ARKG$/i, /^ARKW$/i, /^XLF$/i, /^XLE$/i, /^XLK$/i
];

/**
 * Auto-detects the asset type based on ticker symbol and security name
 *
 * @param ticker - The ticker symbol (e.g., "AAPL", "BTC-USD", "SPY")
 * @param securityName - Optional security name for additional context
 * @returns The detected AssetCategory
 */
export function detectAssetType(
  ticker: string | null | undefined,
  securityName?: string | null
): AssetCategory {
  if (!ticker) return AssetCategory.OTHER;

  const tickerUpper = ticker.toUpperCase().trim();
  const nameUpper = securityName?.toUpperCase() || '';

  // Check for crypto patterns
  // Pattern: BTC-USD, ETH-USDT, SOL-PERP, etc.
  if (tickerUpper.includes('-USD') || tickerUpper.includes('-USDT') ||
      tickerUpper.includes('-USDC') || tickerUpper.includes('-PERP')) {
    return AssetCategory.CRYPTO;
  }

  // Check if base ticker is a known crypto
  const baseTicker = tickerUpper.split('-')[0].split('/')[0];
  if (CRYPTO_TICKERS.has(baseTicker)) {
    return AssetCategory.CRYPTO;
  }

  // Check security name for crypto indicators
  if (nameUpper.includes('BITCOIN') || nameUpper.includes('ETHEREUM') ||
      nameUpper.includes('CRYPTO') || nameUpper.includes('SOLANA')) {
    return AssetCategory.CRYPTO;
  }

  // Check for ETF patterns
  if (ETF_PATTERNS.some(pattern => pattern.test(tickerUpper))) {
    return AssetCategory.ETF;
  }

  // Check security name for ETF indicators
  if (nameUpper.includes('ETF') || nameUpper.includes('FUND') ||
      nameUpper.includes('INDEX')) {
    return AssetCategory.ETF;
  }

  // Check for bond indicators
  if (nameUpper.includes('BOND') || nameUpper.includes('TREASURY') ||
      nameUpper.includes('FIXED INCOME')) {
    return AssetCategory.FIXED_INCOME;
  }

  // Default to EQUITY for standard ticker formats (1-5 uppercase letters)
  if (/^[A-Z]{1,5}$/.test(tickerUpper)) {
    return AssetCategory.EQUITY;
  }

  return AssetCategory.OTHER;
}
