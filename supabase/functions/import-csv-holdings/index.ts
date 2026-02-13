import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  parseRobinhoodTransactions,
  parseIBKRTransactions,
  parseCoinbaseTransactions,
  parseBinanceTransactions,
  aggregateTransactionsToHoldings,
  getBrokerDisplayName,
} from "../_shared/transaction-parsers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, privy-user-id",
};

type BrokerType = 'manual' | 'robinhood' | 'ibkr' | 'coinbase' | 'binance';
type ParseMode = 'transactions' | 'holdings';

interface ImportRequest {
  broker: BrokerType;
  data: string; // CSV text for transactions, or JSON array for manual holdings
  parseMode: ParseMode;
}

interface HoldingRow {
  security_name: string;
  ticker?: string | null;
  quantity: number;
  close_price: number;
  value: number;
  cost_basis: number;
  asset_type?: string | null;
  institution_name: string;
  broker_source?: string;
  import_batch_id?: string;
  imported_at?: string;
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

    const requestBody = await req.json();

    // Support both old format (array of holdings) and new format (ImportRequest object)
    let holdings: HoldingRow[];
    let broker: BrokerType;
    let parseMode: ParseMode;
    let batchId: string;

    if (Array.isArray(requestBody)) {
      // Old format: direct array of holdings (backward compatibility)
      holdings = requestBody;
      broker = 'manual';
      parseMode = 'holdings';
      batchId = crypto.randomUUID();
    } else {
      // New format: ImportRequest object
      const importRequest = requestBody as ImportRequest;
      broker = importRequest.broker || 'manual';
      parseMode = importRequest.parseMode || 'holdings';
      batchId = crypto.randomUUID();

      if (parseMode === 'transactions') {
        // Parse transactions and aggregate to holdings
        let transactions;

        try {
          switch (broker) {
            case 'robinhood':
              transactions = parseRobinhoodTransactions(importRequest.data);
              break;
            case 'ibkr':
              transactions = parseIBKRTransactions(importRequest.data);
              break;
            case 'coinbase':
              transactions = parseCoinbaseTransactions(importRequest.data);
              break;
            case 'binance':
              transactions = parseBinanceTransactions(importRequest.data);
              break;
            default:
              throw new Error(`Unsupported broker for transaction parsing: ${broker}`);
          }

          const aggregatedHoldings = aggregateTransactionsToHoldings(transactions);

          // Convert to HoldingRow format
          holdings = aggregatedHoldings.map(h => ({
            security_name: h.security_name,
            ticker: h.ticker,
            quantity: h.quantity,
            close_price: 0, // will be updated by price feed
            value: 0, // calculated on frontend
            cost_basis: h.total_cost_basis,
            asset_type: h.asset_type,
            institution_name: getBrokerDisplayName(broker),
            broker_source: broker,
          }));
        } catch (parseError: any) {
          return new Response(
            JSON.stringify({
              error: `Failed to parse ${broker} CSV: ${parseError.message}`,
              details: parseError.stack
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        // Parse as JSON holdings array
        try {
          holdings = typeof importRequest.data === 'string'
            ? JSON.parse(importRequest.data)
            : importRequest.data;
        } catch (parseError) {
          return new Response(
            JSON.stringify({ error: "Invalid holdings JSON data" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    if (!Array.isArray(holdings) || holdings.length === 0) {
      return new Response(
        JSON.stringify({ error: "No holdings to import" }),
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

    // Get or create user mapping
    let { data: mapping } = await supabaseAdmin
      .from("privy_user_mapping")
      .select("supabase_user_id")
      .eq("privy_user_id", privyUserId)
      .single();

    if (!mapping) {
      // Create the user if mapping doesn't exist
      // Sanitize the Privy ID for use in email (remove colons and special chars)
      const sanitizedId = privyUserId.replace(/[^a-zA-Z0-9]/g, '-');

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: `${sanitizedId}@privy.local`,
        email_confirm: true,
        user_metadata: {
          privy_user_id: privyUserId,
        },
        app_metadata: {
          provider: "privy",
          providers: ["privy"],
        },
      });

      if (authError || !authData.user) {
        throw new Error(`Failed to create user: ${authError?.message}`);
      }

      const { error: mappingError } = await supabaseAdmin
        .from("privy_user_mapping")
        .insert({
          privy_user_id: privyUserId,
          supabase_user_id: authData.user.id,
        });

      if (mappingError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Failed to create mapping: ${mappingError.message}`);
      }

      mapping = { supabase_user_id: authData.user.id };
    }

    // Delete existing holdings from this broker for this user
    // This ensures new uploads replace old data instead of duplicating
    if (broker !== 'manual') {
      const { error: deleteError } = await supabaseAdmin
        .from("portfolio_holdings")
        .delete()
        .eq("user_id", mapping.supabase_user_id)
        .eq("broker_source", broker);

      if (deleteError) {
        console.warn(`Warning: Could not delete old ${broker} holdings:`, deleteError.message);
        // Continue anyway - better to have duplicates than fail the import
      }
    } else {
      // For manual imports, delete old CSV Import holdings
      const { error: deleteError } = await supabaseAdmin
        .from("portfolio_holdings")
        .delete()
        .eq("user_id", mapping.supabase_user_id)
        .eq("institution_name", "CSV Import")
        .is("broker_source", null);

      if (deleteError) {
        console.warn("Warning: Could not delete old manual CSV holdings:", deleteError.message);
      }
    }

    // Insert holdings with the correct user_id and tracking fields
    const now = new Date().toISOString();
    const holdingsToInsert = holdings.map((h) => ({
      user_id: mapping!.supabase_user_id,
      security_name: h.security_name,
      ticker: h.ticker,
      quantity: h.quantity,
      close_price: h.close_price,
      value: h.value,
      cost_basis: h.cost_basis,
      asset_type: h.asset_type,
      institution_name: h.institution_name || getBrokerDisplayName(broker),
      broker_source: broker,
      import_batch_id: batchId,
      imported_at: now,
      transaction_count: parseMode === 'transactions' ? 1 : 0, // Will be enhanced later with full transaction history
    }));

    const { error: insertError } = await supabaseAdmin
      .from("portfolio_holdings")
      .insert(holdingsToInsert);

    if (insertError) {
      throw new Error(`Failed to insert holdings: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: holdings.length,
        broker: broker,
        parseMode: parseMode,
        batchId: batchId,
        message: `Successfully imported ${holdings.length} holdings from ${getBrokerDisplayName(broker)}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in import-csv-holdings:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
