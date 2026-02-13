import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID");
    const PLAID_SECRET = Deno.env.get("PLAID_SECRET");
    const PLAID_ENV = Deno.env.get("PLAID_ENV") || "development";

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      throw new Error("Plaid credentials not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    const { public_token, metadata } = await req.json();
    if (!public_token) throw new Error("Missing public_token");

    const plaidBaseUrl = PLAID_ENV === "sandbox"
      ? "https://sandbox.plaid.com"
      : PLAID_ENV === "development"
        ? "https://development.plaid.com"
        : "https://production.plaid.com";

    // Exchange public token for access token
    const exchangeRes = await fetch(`${plaidBaseUrl}/item/public_token/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token,
      }),
    });

    const exchangeData = await exchangeRes.json();
    if (!exchangeRes.ok) {
      throw new Error(`Plaid exchange error: ${JSON.stringify(exchangeData)}`);
    }

    const accessToken = exchangeData.access_token;
    const itemId = exchangeData.item_id;
    const institutionName = metadata?.institution?.name || "Unknown";

    // Store plaid item using service role (bypasses RLS for the insert with user_id)
    const { data: plaidItem, error: insertError } = await supabaseAdmin
      .from("plaid_items")
      .insert({
        user_id: user.id,
        access_token: accessToken,
        item_id: itemId,
        institution_name: institutionName,
      })
      .select("id")
      .single();

    if (insertError) throw new Error(`DB error: ${insertError.message}`);

    // Fetch investment holdings
    const holdingsRes = await fetch(`${plaidBaseUrl}/investments/holdings/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: accessToken,
      }),
    });

    const holdingsData = await holdingsRes.json();
    if (!holdingsRes.ok) {
      throw new Error(`Plaid holdings error: ${JSON.stringify(holdingsData)}`);
    }

    // Build securities lookup
    const securitiesMap = new Map<string, any>();
    for (const sec of holdingsData.securities || []) {
      securitiesMap.set(sec.security_id, sec);
    }

    // Insert holdings
    const holdingsToInsert = (holdingsData.holdings || []).map((h: any) => {
      const sec = securitiesMap.get(h.security_id);
      return {
        user_id: user.id,
        plaid_item_id: plaidItem.id,
        security_name: sec?.name || "Unknown",
        ticker: sec?.ticker_symbol || null,
        quantity: h.quantity,
        close_price: sec?.close_price || 0,
        value: h.quantity * (sec?.close_price || 0),
        cost_basis: h.cost_basis || null,
        asset_type: sec?.type || null,
        institution_name: institutionName,
      };
    });

    if (holdingsToInsert.length > 0) {
      const { error: holdingsError } = await supabaseAdmin
        .from("portfolio_holdings")
        .insert(holdingsToInsert);
      if (holdingsError) {
        console.error("Holdings insert error:", holdingsError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        holdings_count: holdingsToInsert.length,
        institution: institutionName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("plaid-exchange-token error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
