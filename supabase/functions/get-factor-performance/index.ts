import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FACTORS_API_URL = Deno.env.get("FACTORS_API_URL") || "http://localhost:8000";
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 3600_000; // 1 hour

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { factors = [], limit = 10, get_time_series = false, start_date, end_date } = await req.json();
    const cacheKey = get_time_series
      ? `ts:${factors.join(',')}:${start_date}:${end_date}`
      : `perf:${factors.join(',')}:${limit}`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Cache hit for ${cacheKey}`);
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Determine endpoint and build URL
    let apiUrl: string;
    if (get_time_series) {
      const params = new URLSearchParams({
        factors: factors.join(','),
        normalize_to_100: 'true'
      });
      if (start_date) params.append('start_date', start_date);
      if (end_date) params.append('end_date', end_date);
      apiUrl = `${FACTORS_API_URL}/factors/time-series?${params}`;
      console.log(`Fetching time series from ${apiUrl}`);
    } else {
      apiUrl = `${FACTORS_API_URL}/factors/compare`;
      console.log(`Fetching from ${apiUrl}`);
    }

    // Fetch from factors API
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Factors API error: ${response.status}`);
    }

    const data = await response.json();
    cache.set(cacheKey, { data, timestamp: Date.now() });

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error in get-factor-performance:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
