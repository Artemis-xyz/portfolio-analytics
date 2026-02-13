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
import { detectAssetType } from "../_shared/asset-type-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, privy-user-id",
};

// Error codes for specific failure scenarios
enum ErrorCode {
  MISSING_PRIVY_USER_ID = 'MISSING_PRIVY_USER_ID',
  INVALID_REQUEST_BODY = 'INVALID_REQUEST_BODY',
  EMPTY_HOLDINGS = 'EMPTY_HOLDINGS',
  CSV_PARSE_ERROR = 'CSV_PARSE_ERROR',
  ENV_VARS_MISSING = 'ENV_VARS_MISSING',
  SUPABASE_CLIENT_ERROR = 'SUPABASE_CLIENT_ERROR',
  USER_LOOKUP_ERROR = 'USER_LOOKUP_ERROR',
  USER_CREATE_ERROR = 'USER_CREATE_ERROR',
  MAPPING_CREATE_ERROR = 'MAPPING_CREATE_ERROR',
  INSERT_ERROR = 'INSERT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

interface StructuredError {
  error: string;
  errorCode: ErrorCode;
  details?: any;
  timestamp: string;
}

function createErrorResponse(
  errorCode: ErrorCode,
  message: string,
  details?: any
): Response {
  const errorResponse: StructuredError = {
    error: message,
    errorCode,
    details: details || {},
    timestamp: new Date().toISOString(),
  };

  console.error(`[${errorCode}] ${message}`, details);

  const status = errorCode === ErrorCode.MISSING_PRIVY_USER_ID ||
                 errorCode === ErrorCode.INVALID_REQUEST_BODY ||
                 errorCode === ErrorCode.EMPTY_HOLDINGS ||
                 errorCode === ErrorCode.CSV_PARSE_ERROR ? 400 : 500;

  return new Response(
    JSON.stringify(errorResponse),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

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
  position_direction?: 'long' | 'short';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log('🔧 Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      urlValid: supabaseUrl?.includes('supabase.co') || supabaseUrl?.includes('localhost'),
    });

    if (!supabaseUrl || !supabaseKey) {
      return createErrorResponse(
        ErrorCode.ENV_VARS_MISSING,
        "Server configuration error. Missing environment variables.",
        { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey }
      );
    }

    const privyUserId = req.headers.get("privy-user-id");
    if (!privyUserId) {
      return createErrorResponse(
        ErrorCode.MISSING_PRIVY_USER_ID,
        "Missing privy-user-id header"
      );
    }

    console.log('👤 Request from user:', privyUserId);

    const requestBody = await req.json();

    console.log('📦 Request body type:', Array.isArray(requestBody) ? 'array' : 'object');

    // Support both old format (array of holdings) and new format (ImportRequest object)
    let holdings: HoldingRow[];
    let broker: BrokerType;
    let parseMode: ParseMode;
    let batchId: string;

    if (Array.isArray(requestBody)) {
      // Old format: direct array of holdings (backward compatibility)
      console.log('📋 Legacy format: direct array of', requestBody.length, 'holdings');
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

      console.log('📋 Import request:', { broker, parseMode, dataLength: importRequest.data?.length });

      if (parseMode === 'transactions') {
        // Parse transactions and aggregate to holdings
        let transactions;

        console.log(`🔄 Parsing ${broker} transactions...`);

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
              return createErrorResponse(
                ErrorCode.CSV_PARSE_ERROR,
                `Unsupported broker for transaction parsing: ${broker}`,
                { broker, parseMode }
              );
          }

          console.log('✅ Parsed', transactions.length, 'transactions');

          const aggregatedHoldings = aggregateTransactionsToHoldings(transactions);
          console.log('✅ Aggregated to', aggregatedHoldings.length, 'holdings');

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
            position_direction: h.position_direction,
          }));
        } catch (parseError: any) {
          console.error('❌ CSV parse error:', parseError);
          return createErrorResponse(
            ErrorCode.CSV_PARSE_ERROR,
            `Failed to parse ${broker} CSV: ${parseError.message}`,
            { broker, parseMode, errorStack: parseError.stack }
          );
        }
      } else {
        // Parse as JSON holdings array
        console.log('📊 Parsing holdings JSON...');
        try {
          holdings = typeof importRequest.data === 'string'
            ? JSON.parse(importRequest.data)
            : importRequest.data;
          console.log('✅ Parsed', holdings.length, 'holdings from JSON');
        } catch (parseError: any) {
          console.error('❌ JSON parse error:', parseError);
          return createErrorResponse(
            ErrorCode.INVALID_REQUEST_BODY,
            "Invalid holdings JSON data",
            { parseError: parseError.message }
          );
        }
      }
    }

    if (!Array.isArray(holdings) || holdings.length === 0) {
      console.warn('⚠️ No holdings to import');
      return createErrorResponse(
        ErrorCode.EMPTY_HOLDINGS,
        "No holdings to import",
        { isArray: Array.isArray(holdings), length: holdings?.length }
      );
    }

    console.log('🔌 Creating Supabase admin client...');
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get or create user mapping
    console.log('👤 Looking up user mapping for:', privyUserId);

    let { data: mapping, error: mappingError } = await supabaseAdmin
      .from("privy_user_mapping")
      .select("supabase_user_id")
      .eq("privy_user_id", privyUserId)
      .single();

    if (mappingError && mappingError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('❌ User mapping lookup error:', mappingError);
      return createErrorResponse(
        ErrorCode.USER_LOOKUP_ERROR,
        "Failed to lookup user mapping",
        { privyUserId, error: mappingError.message, code: mappingError.code }
      );
    }

    console.log('✅ Mapping lookup result:', mapping ? 'Found' : 'Not found');

    if (!mapping) {
      // Create the user if mapping doesn't exist
      console.log('🆕 Creating new user for Privy ID:', privyUserId);
      const sanitizedId = privyUserId.replace(/[^a-zA-Z0-9]/g, '-');

      try {
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
          console.error('❌ User creation failed:', authError);
          return createErrorResponse(
            ErrorCode.USER_CREATE_ERROR,
            "Failed to create user account",
            { privyUserId, error: authError?.message }
          );
        }

        console.log('✅ User created:', authData.user.id);

        const { error: mappingInsertError } = await supabaseAdmin
          .from("privy_user_mapping")
          .insert({
            privy_user_id: privyUserId,
            supabase_user_id: authData.user.id,
          });

        if (mappingInsertError) {
          console.error('❌ Mapping creation failed:', mappingInsertError);
          // Rollback: delete the user we just created
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          return createErrorResponse(
            ErrorCode.MAPPING_CREATE_ERROR,
            "Failed to create user mapping",
            { privyUserId, error: mappingInsertError.message }
          );
        }

        console.log('✅ Mapping created');
        mapping = { supabase_user_id: authData.user.id };
      } catch (error: any) {
        console.error('❌ User creation exception:', error);
        return createErrorResponse(
          ErrorCode.USER_CREATE_ERROR,
          "Failed to create user: " + error.message,
          { privyUserId }
        );
      }
    }

    // Delete existing holdings from this broker for this user
    // This ensures new uploads replace old data instead of duplicating
    console.log('🗑️ Deleting old holdings for broker:', broker);
    if (broker !== 'manual') {
      const { error: deleteError } = await supabaseAdmin
        .from("portfolio_holdings")
        .delete()
        .eq("user_id", mapping.supabase_user_id)
        .eq("broker_source", broker);

      if (deleteError) {
        console.warn(`⚠️ Warning: Could not delete old ${broker} holdings:`, deleteError.message);
        // Continue anyway - better to have duplicates than fail the import
      } else {
        console.log('✅ Old holdings deleted');
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
        console.warn("⚠️ Warning: Could not delete old manual CSV holdings:", deleteError.message);
      } else {
        console.log('✅ Old manual holdings deleted');
      }
    }

    // Fetch existing holdings to check for duplicates
    const { data: existingHoldings } = await supabaseAdmin
      .from("portfolio_holdings")
      .select("id, ticker, position_direction")
      .eq("user_id", mapping!.supabase_user_id);

    // Separate holdings into updates and inserts
    const now = new Date().toISOString();
    const holdingsToInsert = [];
    const holdingsToUpdate = [];

    for (const h of holdings) {
      // Auto-detect asset type if not provided
      const detectedAssetType = h.asset_type || detectAssetType(h.ticker, h.security_name);
      const positionDirection = h.position_direction || 'long';

      // Check if this holding already exists (same ticker + position_direction)
      const existing = existingHoldings?.find(
        (eh) =>
          eh.ticker?.toUpperCase() === h.ticker?.toUpperCase() &&
          eh.position_direction === positionDirection
      );

      const holdingData = {
        user_id: mapping!.supabase_user_id,
        security_name: h.security_name,
        ticker: h.ticker,
        quantity: h.quantity,
        close_price: h.close_price,
        value: h.value,
        cost_basis: h.cost_basis,
        asset_type: detectedAssetType,
        institution_name: h.institution_name || getBrokerDisplayName(broker),
        broker_source: broker,
        import_batch_id: batchId,
        imported_at: now,
        transaction_count: parseMode === 'transactions' ? 1 : 0,
        position_direction: positionDirection,
      };

      if (existing) {
        // Update existing holding
        holdingsToUpdate.push({ id: existing.id, data: holdingData });
      } else {
        // Insert new holding
        holdingsToInsert.push(holdingData);
      }
    }

    console.log('💾 Processing holdings:', {
      toInsert: holdingsToInsert.length,
      toUpdate: holdingsToUpdate.length,
      userId: mapping!.supabase_user_id,
      broker,
      batchId
    });

    // Insert new holdings
    if (holdingsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("portfolio_holdings")
        .insert(holdingsToInsert);

      if (insertError) {
        console.error('❌ Holdings insert failed:', insertError);
        return createErrorResponse(
          ErrorCode.INSERT_ERROR,
          "Failed to save holdings to database",
          {
            count: holdingsToInsert.length,
            error: insertError.message,
            code: insertError.code
          }
        );
      }
    }

    // Update existing holdings
    if (holdingsToUpdate.length > 0) {
      for (const { id, data } of holdingsToUpdate) {
        const { error: updateError } = await supabaseAdmin
          .from("portfolio_holdings")
          .update(data)
          .eq("id", id);

        if (updateError) {
          console.error('❌ Holding update failed:', updateError);
          // Continue with other updates even if one fails
        }
      }
    }

    console.log('✅ Holdings processed successfully');

    const successResponse = {
      success: true,
      count: holdings.length,
      inserted: holdingsToInsert.length,
      updated: holdingsToUpdate.length,
      broker: broker,
      parseMode: parseMode,
      batchId: batchId,
      message: holdingsToUpdate.length > 0
        ? `Imported ${holdingsToInsert.length} new and updated ${holdingsToUpdate.length} existing holdings from ${getBrokerDisplayName(broker)}`
        : `Successfully imported ${holdings.length} holdings from ${getBrokerDisplayName(broker)}`,
    };

    console.log('🎉 Import complete:', successResponse);

    return new Response(
      JSON.stringify(successResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Unexpected error in import-csv-holdings:", error);
    return createErrorResponse(
      ErrorCode.UNKNOWN_ERROR,
      error.message || "An unexpected error occurred",
      { errorStack: error.stack }
    );
  }
});
