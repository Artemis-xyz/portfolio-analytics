import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, privy-user-id",
};

interface UpdateHoldingRequest {
  holding_id: string;
  updates: {
    quantity?: number;
    close_price?: number;
    cost_basis?: number;
    security_name?: string;
    ticker?: string;
    asset_type?: string;
    value?: number;
    position_direction?: 'long' | 'short';
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const privyUserId = req.headers.get("privy-user-id");
    if (!privyUserId) {
      return new Response(
        JSON.stringify({ error: "Missing privy-user-id header" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { holding_id, updates } = await req.json() as UpdateHoldingRequest;

    if (!holding_id) {
      return new Response(
        JSON.stringify({ error: "Missing holding_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!updates || Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: "No updates provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate quantity must be positive
    if (updates.quantity !== undefined && updates.quantity < 0) {
      return new Response(
        JSON.stringify({ error: "Quantity must be positive. Use position_direction to indicate short positions." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get user mapping
    const { data: mapping } = await supabaseAdmin
      .from("privy_user_mapping")
      .select("supabase_user_id")
      .eq("privy_user_id", privyUserId)
      .single();

    if (!mapping) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Recalculate value if quantity or price changed
    const updateData = { ...updates };
    if (updates.quantity !== undefined || updates.close_price !== undefined) {
      // Fetch current values if we need them for calculation
      const { data: currentHolding } = await supabaseAdmin
        .from("portfolio_holdings")
        .select("quantity, close_price")
        .eq("id", holding_id)
        .eq("user_id", mapping.supabase_user_id)
        .single();

      if (currentHolding) {
        const newQuantity = updates.quantity ?? currentHolding.quantity;
        const newPrice = updates.close_price ?? currentHolding.close_price;
        updateData.value = newQuantity * newPrice;
      }
    }

    // Update the holding (RLS will ensure user owns it)
    const { data, error } = await supabaseAdmin
      .from("portfolio_holdings")
      .update(updateData)
      .eq("id", holding_id)
      .eq("user_id", mapping.supabase_user_id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update holding: ${error.message}`);
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: "Holding not found or you do not have permission to update it" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        holding: data,
        message: "Holding updated successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in update-holding:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
