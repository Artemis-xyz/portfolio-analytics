import { useQuery } from "@tanstack/react-query";
import { fetchVaultDetails, type VaultDetailsResponse } from "@/lib/hyperliquid";

// Tracked vault addresses – add more here as needed
const TRACKED_VAULTS = [
  "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303", // HLP
];

export interface EnrichedVault {
  name: string;
  vaultAddress: string;
  leader: string;
  tvl: string;
  apr: number;
  createTimeMillis: number;
  isClosed: boolean;
  details: VaultDetailsResponse;
}

export const useLeadingVaults = () => {
  return useQuery<EnrichedVault[]>({
    queryKey: ["trackedVaults"],
    queryFn: async () => {
      const results = await Promise.all(
        TRACKED_VAULTS.map(async (addr) => {
          const details = await fetchVaultDetails(addr);
          // Derive TVL from the latest account value in the "day" portfolio
          const dayPortfolio = details.portfolio.find(([k]) => k === "day");
          let tvl = "0";
          if (dayPortfolio) {
            const history = dayPortfolio[1].accountValueHistory;
            if (history.length > 0) {
              tvl = history[history.length - 1][1];
            }
          }

          // Derive createTimeMillis from the allTime portfolio first entry
          const allTimePortfolio = details.portfolio.find(([k]) => k === "allTime");
          let createTimeMillis = Date.now();
          if (allTimePortfolio) {
            const history = allTimePortfolio[1].accountValueHistory;
            if (history.length > 0) {
              createTimeMillis = history[0][0];
            }
          }

          return {
            name: details.name,
            vaultAddress: details.vaultAddress,
            leader: details.leader,
            tvl,
            apr: details.apr ?? 0,
            createTimeMillis,
            isClosed: details.isClosed,
            details,
          } satisfies EnrichedVault;
        })
      );

      return results.filter((v) => !v.isClosed);
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
};
