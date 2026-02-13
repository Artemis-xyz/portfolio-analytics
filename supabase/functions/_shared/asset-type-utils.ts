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
