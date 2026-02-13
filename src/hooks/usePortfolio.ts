import { useQuery } from "@tanstack/react-query";
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
  updated_at: string;
}

export interface LinkedAccount {
  id: string;
  institution_name: string | null;
  created_at: string;
}

export const usePortfolioHoldings = (userId: string | undefined) => {
  return useQuery<Holding[]>({
    queryKey: ["holdings", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("portfolio_holdings")
        .select("*")
        .eq("user_id", userId)
        .order("value", { ascending: false });
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

export const useLinkedAccounts = (userId: string | undefined) => {
  return useQuery<LinkedAccount[]>({
    queryKey: ["linked_accounts", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("plaid_items")
        .select("id, institution_name, created_at")
        .eq("user_id", userId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });
};
