import { protocolVaults, userVaults } from "./vaultsData";

export interface VaultDetail {
  name: string;
  address: string;
  tvl: string;
  pastMonthReturn: number;
  apy: number;
  yourDeposits: string;
  allTimeEarned: string;
  leader: string;
  description: string;
  strategies: string[];
  metrics: {
    pnl: string;
    maxDrawdown: string;
    volume: string;
    sharpe: string;
    sortino: string;
  };
  positions: {
    coin: string;
    leverage: string;
    size: string;
    sizeToken: string;
    positionValue: string;
    entryPrice: string;
    markPrice: string;
    pnl: string;
    pnlPercent: string;
    liqPrice: string;
    margin: string;
    funding: string;
  }[];
}

const generateRandomPositions = (count: number) => {
  const coins = ["TST", "XPL", "ETH", "SOL", "BTC", "STABLE", "ZORA", "MNT", "ARB", "OP"];
  const positions = [];
  
  for (let i = 0; i < count; i++) {
    const coin = coins[i % coins.length];
    const isProfit = Math.random() > 0.3;
    const pnlValue = (Math.random() * 5000 + 100).toFixed(2);
    const pnlPercent = (Math.random() * 100 + 10).toFixed(1);
    
    positions.push({
      coin,
      leverage: `${Math.floor(Math.random() * 20 + 5)}x`,
      size: `${(Math.random() * 1000000 + 10000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ${coin}`,
      sizeToken: coin,
      positionValue: `${(Math.random() * 100000 + 10000).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} USDC`,
      entryPrice: (Math.random() * 2 + 0.01).toFixed(6),
      markPrice: (Math.random() * 2 + 0.01).toFixed(6),
      pnl: isProfit ? `+$${pnlValue}` : `-$${pnlValue}`,
      pnlPercent: isProfit ? `+${pnlPercent}%` : `-${pnlPercent}%`,
      liqPrice: Math.random() > 0.2 ? (Math.random() * 1000 + 10).toFixed(2) : "N/A",
      margin: `$${(Math.random() * 5000 + 500).toFixed(2)} (Cross)`,
      funding: Math.random() > 0.5 ? `$${(Math.random() * 500 + 50).toFixed(2)}` : `-$${(Math.random() * 500 + 50).toFixed(2)}`,
    });
  }
  
  return positions;
};

const generateVaultDetail = (vault: { name: string; creator: string; apy: number; tvl: string; yourDeposit: string; ageDays: number }): VaultDetail => {
const descriptions: Record<string, string> = {
    "Hyperliquidity Pool (HLP)": "This community-owned vault provides liquidity through multiple market making strategies, performs liquidations, and accrues platform fees.",
    "SMB Factor": "Tests whether small caps outperform large caps. The Size (SMB) factor-mimicking portfolio is an equal weighted long-short portfolio that longs the smallest 50% of eligible assets per period and shorts the largest 50%.",
    "Momentum Factor": "Tests whether winners keep winning and losers keep losing. Momentum is calculated using a 3-week, volatility-adjusted framework designed to capture consistent price trends rather than short-term spikes.",
    "Value Factor": "Tests whether cheap tokens outperform expensive tokens. The Value factor-mimicking portfolio longs assets with the highest value (lowest mc_fees_ratio) and shorts assets with the lowest value.",
    "Market Risk Factor": "Captures broad crypto market exposure. The Market Risk factor-mimicking portfolio is a long only portfolio constructed of the top 10 assets by market cap, behaving similarly to a crypto market index.",
  };

  const numStrategies = Math.floor(Math.random() * 5) + 1;
  const strategies = Array.from({ length: numStrategies }, () => 
    `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
  );

  const pnlValue = (Math.random() * 2000000 + 100000).toFixed(2);
  const isPositivePnl = Math.random() > 0.3;

  return {
    name: vault.name,
    address: vault.creator,
    tvl: vault.tvl,
    pastMonthReturn: vault.apy,
    apy: vault.apy,
    yourDeposits: vault.yourDeposit,
    allTimeEarned: `$${(Math.random() * 500).toFixed(2)}`,
    leader: vault.creator,
    description: descriptions[vault.name] || `${vault.name} is a professionally managed vault employing sophisticated trading strategies to generate consistent returns for depositors.`,
    strategies,
    metrics: {
      pnl: isPositivePnl ? `$${Number(pnlValue).toLocaleString()}` : `-$${Number(pnlValue).toLocaleString()}`,
      maxDrawdown: `${(Math.random() * 15 + 2).toFixed(2)}%`,
      volume: `$${(Math.random() * 500000000 + 10000000).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      sharpe: (Math.random() * 3 + 0.5).toFixed(2),
      sortino: (Math.random() * 4 + 0.8).toFixed(2),
    },
    positions: generateRandomPositions(Math.floor(Math.random() * 4) + 2),
  };
};

export const getVaultIdFromName = (name: string): string => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

// Generate vault details for all vaults
const allVaults = [...protocolVaults, ...userVaults];

export const vaultDetails: Record<string, VaultDetail> = {};

allVaults.forEach((vault) => {
  const id = getVaultIdFromName(vault.name);
  vaultDetails[id] = generateVaultDetail(vault);
});
