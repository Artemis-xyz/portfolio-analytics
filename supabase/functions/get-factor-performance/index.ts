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
    const { factors = [], limit = 10 } = await req.json();
    const cacheKey = `perf:${factors.join(',')}:${limit}`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Cache hit for ${cacheKey}`);
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Fetch from factors API
    console.log(`Fetching from ${FACTORS_API_URL}/factors/compare`);
    const response = await fetch(`${FACTORS_API_URL}/factors/compare`);

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
