import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { filterHoldingsByCategory } from '@/lib/assetTypes';

export interface FactorData {
  factor: string;
  annualized_return: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  cumulative_returns: number;
  years?: number;
}

export interface Recommendation {
  factor: string;
  current: number;
  optimal?: number;
  action: 'increase' | 'reduce' | 'maintain';
  reason: string;
  impact?: string;
}

export interface FactorAnalysisResult {
  crypto: FactorData[] | null;
  equity: FactorData[] | null;
  summary: string;
  recommendations?: Recommendation[];
}

/**
 * Custom hook to fetch factor analysis for a portfolio
 *
 * @param holdings - Array of holdings with asset_type, ticker, quantity, and value
 * @param enabled - Whether to enable the query (default: true)
 * @returns React Query result with factor analysis data
 */
export function useFactorAnalysis(
  holdings: Array<{ asset_type: string | null; ticker: string; quantity: number; value: number }>,
  enabled: boolean = true
) {
  const filtered = filterHoldingsByCategory(holdings);

  return useQuery<FactorAnalysisResult>({
    queryKey: ['factor-analysis', filtered.crypto.length, filtered.equity.length, holdings.length],
    queryFn: async () => {
      console.log('Fetching factor analysis for portfolio...');

      const { data, error } = await supabase.functions.invoke(
        'compute-portfolio-factors',
        {
          body: {
            holdings: holdings.map(h => ({
              ticker: h.ticker,
              asset_type: h.asset_type,
              quantity: h.quantity,
              value: h.value,
            }))
          }
        }
      );

      if (error) {
        console.error('Factor analysis error:', error);
        throw error;
      }

      console.log('Factor analysis result:', data);
      return data as FactorAnalysisResult;
    },
    enabled: enabled && holdings.length >= 5,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/**
 * Custom hook to fetch factor performance logs (historical data)
 *
 * @param factors - Array of factor names to fetch (optional)
 * @param limit - Number of recent runs to return (default: 10)
 * @param enabled - Whether to enable the query (default: true)
 * @returns React Query result with factor performance data
 */
export function useFactorPerformance(
  factors: string[] = [],
  limit: number = 10,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['factor-performance', factors, limit],
    queryFn: async () => {
      console.log('Fetching factor performance logs...');

      const { data, error } = await supabase.functions.invoke(
        'get-factor-performance',
        {
          body: { factors, limit }
        }
      );

      if (error) {
        console.error('Factor performance error:', error);
        throw error;
      }

      console.log('Factor performance result:', data);
      return data;
    },
    enabled,
    staleTime: 60 * 60 * 1000, // 1 hour (matches edge function cache)
    cacheTime: 2 * 60 * 60 * 1000, // 2 hours
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
