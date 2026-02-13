import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FactorTimeSeries {
  factor: string;
  dates: string[];
  returns: number[];
  cumulative_returns: number[];
}

export function useFactorTimeSeries(
  factors: string[],
  startDate?: string,
  endDate?: string,
  enabled: boolean = true
) {
  return useQuery<Record<string, FactorTimeSeries>>({
    queryKey: ['factor-time-series', factors, startDate, endDate],
    queryFn: async () => {
      console.log('Fetching factor time series...', factors);

      const { data, error } = await supabase.functions.invoke(
        'get-factor-performance',
        {
          body: {
            factors,
            start_date: startDate,
            end_date: endDate,
            get_time_series: true,
          }
        }
      );

      if (error) {
        console.error('Factor time series error:', error);
        throw error;
      }

      console.log('Factor time series result:', data);
      return data as Record<string, FactorTimeSeries>;
    },
    enabled: enabled && factors.length > 0,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours (replaces cacheTime)
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
