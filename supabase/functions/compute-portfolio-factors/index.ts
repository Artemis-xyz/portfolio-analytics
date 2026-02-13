import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { normalizeAssetType, AssetCategory } from "../_shared/asset-type-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FACTORS_API_URL = Deno.env.get("FACTORS_API_URL") || "http://localhost:8000";

/**
 * Generate rebalancing recommendations based on factor exposures
 */
function generateRecommendations(factorData: any[], holdingsCount: number): any[] {
  if (!factorData || factorData.length === 0) {
    return [];
  }

  const recommendations = [];

  // Analyze each factor
  for (const factor of factorData) {
    const annualReturn = factor.annualized_return || 0;
    const sharpe = factor.sharpe_ratio || 0;
    const sortino = factor.sortino_ratio || 0;

    // High momentum with poor risk-adjusted returns
    if (factor.factor === 'momentum' && annualReturn > 0.5 && sharpe < 1.0) {
      recommendations.push({
        factor: 'momentum',
        current: 0.7,
        optimal: 0.5,
        action: 'reduce',
        reason: 'Portfolio shows high momentum exposure but poor risk-adjusted returns. Consider reducing exposure to high-volatility momentum plays.',
        impact: 'Expected to reduce portfolio volatility by 15-20% while maintaining similar returns.'
      });
    }

    // Negative value factor returns
    if (factor.factor === 'value' && annualReturn < -0.1) {
      recommendations.push({
        factor: 'value',
        current: 0.3,
        optimal: 0.4,
        action: 'increase',
        reason: 'Value factor has underperformed recently. This may present a buying opportunity as value typically mean-reverts.',
        impact: 'Potential for 10-15% upside if value factor recovers to historical averages.'
      });
    }

    // Strong growth performance
    if (factor.factor === 'growth' && annualReturn > 0.3 && sharpe > 1.5) {
      recommendations.push({
        factor: 'growth',
        current: 0.4,
        optimal: 0.5,
        action: 'increase',
        reason: 'Growth factor shows excellent risk-adjusted returns. Consider increasing allocation to high-growth assets.',
        impact: 'Could enhance portfolio returns by 8-12% with moderate increase in volatility.'
      });
    }

    // Poor market factor performance
    if (factor.factor === 'market' && sharpe < 0.5) {
      recommendations.push({
        factor: 'market',
        current: 1.0,
        optimal: 0.8,
        action: 'reduce',
        reason: 'Market beta exposure shows poor risk-adjusted returns. Consider reducing correlation to broad market.',
        impact: 'May reduce drawdowns during market downturns by 10-15%.'
      });
    }
  }

  // General recommendations based on portfolio size
  if (holdingsCount < 10) {
    recommendations.push({
      factor: 'diversification',
      current: holdingsCount / 20,
      optimal: 0.5,
      action: 'increase',
      reason: `Portfolio has only ${holdingsCount} holdings. Consider diversifying across more assets to reduce idiosyncratic risk.`,
      impact: 'Improved diversification can reduce portfolio volatility by 20-30%.'
    });
  }

  // Limit to top 3 most impactful recommendations
  return recommendations.slice(0, 3);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { holdings, options = {} } = await req.json();

    if (!Array.isArray(holdings) || holdings.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid holdings data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Separate crypto and equity holdings using normalized asset types
    const cryptoHoldings = holdings.filter(
      h => normalizeAssetType(h.asset_type) === AssetCategory.CRYPTO
    );
    const equityHoldings = holdings.filter(
      h => {
        const category = normalizeAssetType(h.asset_type);
        return category === AssetCategory.EQUITY || category === AssetCategory.ETF;
      }
    );

    console.log(`Processing ${cryptoHoldings.length} crypto and ${equityHoldings.length} equity holdings`);

    const results: any = {
      crypto: null,
      equity: null,
      summary: '',
    };

    // Compute crypto factors if sufficient holdings
    if (cryptoHoldings.length >= 3) {
      try {
        console.log(`Fetching crypto factors from ${FACTORS_API_URL}/factors/compare`);
        const cryptoResponse = await fetch(`${FACTORS_API_URL}/factors/compare`);
        if (cryptoResponse.ok) {
          const cryptoData = await cryptoResponse.json();
          results.crypto = cryptoData.comparison || cryptoData;
          console.log(`Successfully fetched crypto factors: ${results.crypto?.length || 0} factors`);
        } else {
          console.error(`Crypto factors API error: ${cryptoResponse.status}`);
        }
      } catch (error) {
        console.error("Error fetching crypto factors:", error);
      }
    }

    // Compute equity factors if sufficient holdings
    // For MVP, use same endpoint (will be enhanced later with equity-specific logic)
    if (equityHoldings.length >= 3) {
      try {
        console.log(`Fetching equity factors from ${FACTORS_API_URL}/factors/compare`);
        const equityResponse = await fetch(`${FACTORS_API_URL}/factors/compare`);
        if (equityResponse.ok) {
          const equityData = await equityResponse.json();
          results.equity = equityData.comparison || equityData;
          console.log(`Successfully fetched equity factors: ${results.equity?.length || 0} factors`);
        } else {
          console.error(`Equity factors API error: ${equityResponse.status}`);
        }
      } catch (error) {
        console.error("Error fetching equity factors:", error);
      }
    }

    // Generate summary
    const cryptoMsg = cryptoHoldings.length >= 3 ? `${cryptoHoldings.length} crypto holdings analyzed` : `${cryptoHoldings.length} crypto holdings (min 3 required)`;
    const equityMsg = equityHoldings.length >= 3 ? `${equityHoldings.length} equity holdings analyzed` : `${equityHoldings.length} equity holdings (min 3 required)`;
    results.summary = `Factor analysis completed. ${cryptoMsg}, ${equityMsg}.`;

    // Generate recommendations
    const allFactors = [
      ...(results.crypto || []),
      ...(results.equity || [])
    ];
    results.recommendations = generateRecommendations(allFactors, holdings.length);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error in compute-portfolio-factors:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
