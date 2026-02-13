import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, privy-user-id, privy-email",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const privyUserId = req.headers.get("privy-user-id");
    const privyEmail = req.headers.get("privy-email");

    if (!privyUserId) {
      return new Response(
        JSON.stringify({ error: "Missing privy-user-id header" }),
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

    // Check if mapping already exists
    const { data: existingMapping } = await supabaseAdmin
      .from("privy_user_mapping")
      .select("supabase_user_id")
      .eq("privy_user_id", privyUserId)
      .single();

    if (existingMapping) {
      return new Response(
        JSON.stringify({
          supabase_user_id: existingMapping.supabase_user_id,
          message: "User already exists"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new Supabase user
    // Sanitize the Privy ID for use in email (remove colons and special chars)
    const sanitizedId = privyUserId.replace(/[^a-zA-Z0-9]/g, '-');

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: privyEmail || `${sanitizedId}@privy.local`,
      email_confirm: true,
      user_metadata: {
        privy_user_id: privyUserId,
        display_name: privyEmail || privyUserId,
      },
      app_metadata: {
        provider: "privy",
        providers: ["privy"],
      },
    });

    if (authError || !authData.user) {
      throw authError || new Error("Failed to create user");
    }

    // Create mapping
    const { error: mappingError } = await supabaseAdmin
      .from("privy_user_mapping")
      .insert({
        privy_user_id: privyUserId,
        supabase_user_id: authData.user.id,
      });

    if (mappingError) {
      // Clean up the auth user if mapping creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw mappingError;
    }

    return new Response(
      JSON.stringify({
        supabase_user_id: authData.user.id,
        message: "User created successfully"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in create-privy-user:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
