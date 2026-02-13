const API_URL = "https://api.hyperliquid.xyz/info";

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);
  return res.json();
}

// ─── Leading Vaults ───

export interface LeadingVault {
  vaultAddress: string;
  name: string;
  leader: string;
  totalShares: string;
  tvl: string;
  sharePrice: string;
  pnl1D: string;
  pnl7D: string;
  pnl30D: string;
  pnlAllTime: string;
  maxDD: string;
  isOpen: boolean;
  minDeposit: string;
  createdTime: number;
  leaderCommission: string;
}

// Use the HLP vault leader address as a reference user – the user param only
// affects the followerState field and does NOT filter the vault list.
const REFERENCE_USER = "0x677d831aef5328190852e24f13c46cac05f984e7";

export function fetchLeadingVaults(): Promise<LeadingVault[]> {
  return post<LeadingVault[]>({ type: "leadingVaults", user: REFERENCE_USER });
}

// ─── Vault Summaries (all vaults) ───

export interface VaultSummary {
  name: string;
  vaultAddress: string;
  leader: string;
  tvl: string;
  isClosed: boolean;
  relationship: {
    type: string;
    data?: { childAddresses?: string[] };
  };
  createTimeMillis: number;
}

export function fetchVaultSummaries(): Promise<VaultSummary[]> {
  return post<VaultSummary[]>({ type: "vaultSummaries" });
}

// ─── Vault Details ───

export interface PortfolioPeriod {
  accountValueHistory: [number, string][];
  pnlHistory: [number, string][];
  vlm: string;
}

export interface VaultFollower {
  user: string;
  vaultEquity: string;
  pnl: string;
  allTimePnl: string;
  daysFollowing: number;
  vaultEntryTime: number;
  lockupUntil: number;
}

export interface VaultDetailsResponse {
  name: string;
  vaultAddress: string;
  leader: string;
  description: string;
  portfolio: [string, PortfolioPeriod][];
  apr: number;
  followerState: unknown;
  leaderFraction: number;
  leaderCommission: number;
  followers: VaultFollower[];
  maxDistributable: number;
  maxWithdrawable: number;
  isClosed: boolean;
  relationship: unknown;
  allowDeposits: boolean;
  alwaysCloseOnWithdraw: boolean;
}

export function fetchVaultDetails(vaultAddress: string): Promise<VaultDetailsResponse> {
  return post<VaultDetailsResponse>({ type: "vaultDetails", vaultAddress });
}

// ─── Clearinghouse State (positions) ───

export interface AssetPosition {
  type: string;
  position: {
    coin: string;
    szi: string;
    leverage: { type: string; value: number; rawUsd?: string };
    entryPx: string;
    positionValue: string;
    unrealizedPnl: string;
    returnOnEquity: string;
    liquidationPx: string | null;
    marginUsed: string;
    maxLeverage: number;
    cumFunding: {
      allTime: string;
      sinceOpen: string;
      sinceChange: string;
    };
  };
}

export interface ClearinghouseStateResponse {
  marginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  crossMarginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  crossMaintenanceMarginUsed: string;
  withdrawable: string;
  assetPositions: AssetPosition[];
  time: number;
}

export function fetchClearinghouseState(user: string): Promise<ClearinghouseStateResponse> {
  return post<ClearinghouseStateResponse>({ type: "clearinghouseState", user });
}

// ─── User Fills (Trade History) ───

export interface UserFill {
  coin: string;
  px: string;
  sz: string;
  side: "B" | "A";
  time: number;
  startPosition: string;
  dir: string;
  closedPnl: string;
  hash: string;
  oid: number;
  crossed: boolean;
  fee: string;
  tid: number;
  feeToken: string;
}

export function fetchUserFills(user: string): Promise<UserFill[]> {
  return post<UserFill[]>({ type: "userFills", user });
}
