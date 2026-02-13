import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PriceData {
  price: number;
  change: number;
  changePct: number;
  timeSeries?: Array<{ date: string; price: number }>;
}

export type TimeframeKey = "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD";

const TIMEFRAME_TO_RANGE: Record<TimeframeKey, string> = {
  "1W": "5d",
  "1M": "1mo",
  "3M": "3mo",
  "6M": "6mo",
  "1Y": "1y",
  "YTD": "ytd",
};

export const use24hPrices = (tickers: string[], timeframe: TimeframeKey = "1W") => {
  const validTickers = tickers.filter(Boolean);
  const range = TIMEFRAME_TO_RANGE[timeframe];

  return useQuery<Record<string, PriceData>>({
    queryKey: ["prices", validTickers.sort().join(","), range],
    queryFn: async () => {
      if (validTickers.length === 0) return {};

      const res = await supabase.functions.invoke("get-24h-prices", {
        body: { tickers: validTickers, range },
      });

      if (res.error) {
        console.error("Failed to fetch prices:", res.error);
        return {};
      }

      return res.data || {};
    },
    enabled: validTickers.length > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
};
