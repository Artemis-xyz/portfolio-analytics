import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PortfolioData {
  totalValue: number;
  holdings: Array<{
    name: string;
    ticker: string | null;
    quantity: number;
    value: number;
    assetType: string | null;
    percentOfPortfolio: number;
  }>;
  assetAllocation: Record<string, number>;
  riskMetrics?: {
    sharpe: number | null;
    sortino: number | null;
    mdd: number | null;
    beta: number | null;
  };
}

export const usePortfolioInsights = (portfolioData: PortfolioData | null, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["portfolio-insights", portfolioData?.totalValue, portfolioData?.holdings.length],
    queryFn: async () => {
      if (!portfolioData) {
        throw new Error("No portfolio data available");
      }

      const { data, error } = await supabase.functions.invoke("analyze-portfolio", {
        body: { portfolioData },
      });

      if (error) {
        throw new Error(error.message || "Failed to get portfolio insights");
      }

      return data;
    },
    enabled: enabled && portfolioData !== null && portfolioData.holdings.length > 0,
    staleTime: Infinity, // Never auto-refetch, only manual or on mount
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: true, // Refetch on component mount
    retry: 1,
  });
};
