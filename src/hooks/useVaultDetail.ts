import { useQuery } from "@tanstack/react-query";
import {
  fetchVaultDetails,
  fetchClearinghouseState,
  fetchUserFills,
  type VaultDetailsResponse,
  type ClearinghouseStateResponse,
  type UserFill,
} from "@/lib/hyperliquid";

export interface VaultDetailData {
  details: VaultDetailsResponse;
  clearinghouse: ClearinghouseStateResponse;
  fills: UserFill[];
}

export const useVaultDetail = (vaultAddress: string | undefined) => {
  return useQuery<VaultDetailData>({
    queryKey: ["vaultDetail", vaultAddress],
    queryFn: async () => {
      if (!vaultAddress) throw new Error("No vault address");
      const [details, clearinghouse, fills] = await Promise.all([
        fetchVaultDetails(vaultAddress),
        fetchClearinghouseState(vaultAddress),
        fetchUserFills(vaultAddress),
      ]);
      return { details, clearinghouse, fills };
    },
    enabled: !!vaultAddress,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};
