import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, privy-user-id",
};

interface DeleteHoldingRequest {
  holding_id: string;
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

    const { holding_id } = await req.json() as DeleteHoldingRequest;

    if (!holding_id) {
      return new Response(
        JSON.stringify({ error: "Missing holding_id" }),
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

    // Delete the holding (RLS will ensure user owns it)
    const { error, count } = await supabaseAdmin
      .from("portfolio_holdings")
      .delete({ count: 'exact' })
      .eq("id", holding_id)
      .eq("user_id", mapping.supabase_user_id);

    if (error) {
      throw new Error(`Failed to delete holding: ${error.message}`);
    }

    if (count === 0) {
      return new Response(
        JSON.stringify({ error: "Holding not found or you do not have permission to delete it" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Holding deleted successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in delete-holding:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
