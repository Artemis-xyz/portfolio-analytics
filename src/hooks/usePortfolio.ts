import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Holding {
  id: string;
  security_name: string;
  ticker: string | null;
  quantity: number;
  close_price: number;
  value: number;
  cost_basis: number | null;
  asset_type: string | null;
  institution_name: string | null;
  broker_source: string | null;
  import_batch_id: string | null;
  imported_at: string;
  last_transaction_date: string | null;
  transaction_count: number;
  updated_at: string;
  position_direction: 'long' | 'short' | null;
}

export const usePortfolioHoldings = (userId: string | undefined) => {
  return useQuery<Holding[]>({
    queryKey: ["holdings", userId],
    queryFn: async () => {
      console.log("🔍 Fetching holdings for userId:", userId);
      if (!userId) {
        console.log("❌ No userId provided");
        return [];
      }

      // Look up the Supabase UUID for this Privy user
      console.log("🔍 Looking up Supabase UUID for Privy ID:", userId);
      const { data: mapping, error: mappingError } = await supabase
        .from("privy_user_mapping")
        .select("supabase_user_id")
        .eq("privy_user_id", userId)
        .single();

      console.log("📋 Mapping result:", { mapping, mappingError });

      if (!mapping?.supabase_user_id) {
        console.log("❌ No user mapping found for:", userId);
        return [];
      }

      console.log("✅ Found Supabase UUID:", mapping.supabase_user_id);
      console.log("🔍 Querying portfolio_holdings...");

      const { data, error } = await supabase
        .from("portfolio_holdings")
        .select("*")
        .eq("user_id", mapping.supabase_user_id)
        .order("value", { ascending: false });

      console.log("📊 Holdings query result:", { count: data?.length, error });

      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        ...d,
        quantity: Number(d.quantity),
        close_price: Number(d.close_price),
        value: Number(d.value),
        cost_basis: d.cost_basis != null ? Number(d.cost_basis) : null,
      }));
    },
    enabled: !!userId,
  });
};

/**
 * Hook for updating a holding
 */
export function useUpdateHolding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      holdingId,
      updates,
      userId,
    }: {
      holdingId: string;
      updates: Partial<Holding>;
      userId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("update-holding", {
        body: { holding_id: holdingId, updates },
        headers: { "privy-user-id": userId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    },
  });
}

/**
 * Hook for creating a new holding
 */
export function useCreateHolding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      holding,
      userId,
    }: {
      holding: {
        security_name: string;
        ticker?: string | null;
        quantity: number;
        close_price: number;
        cost_basis?: number | null;
        asset_type?: string | null;
        position_direction?: 'long' | 'short';
      };
      userId: string;
    }) => {
      // Use the import-csv-holdings function to create a single holding
      const holdingData = {
        security_name: holding.security_name,
        ticker: holding.ticker || null,
        quantity: holding.quantity,
        close_price: holding.close_price,
        value: holding.quantity * holding.close_price,
        cost_basis: holding.cost_basis || null,
        asset_type: holding.asset_type || null,
        institution_name: "Manual Entry",
        position_direction: holding.position_direction || 'long',
      };

      const { data, error } = await supabase.functions.invoke("import-csv-holdings", {
        body: [holdingData], // Old format: direct array
        headers: { "privy-user-id": userId },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Failed to create holding");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    },
  });
}

/**
 * Hook for deleting a holding
 */
export function useDeleteHolding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      holdingId,
      userId,
    }: {
      holdingId: string;
      userId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("delete-holding", {
        body: { holding_id: holdingId },
        headers: { "privy-user-id": userId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    },
  });
}
