import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PortfolioData {
  totalValue: number;
  holdings: Array<{
    name: string;
    ticker: string | null;
    quantity: number;
    value: number;
    assetType: string | null;
    percentOfPortfolio: number;
  }>;
  assetAllocation: Record<string, number>;
  riskMetrics?: {
    sharpe: number | null;
    sortino: number | null;
    mdd: number | null;
    beta: number | null;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { portfolioData } = await req.json() as { portfolioData: PortfolioData };

    if (!portfolioData || !portfolioData.holdings) {
      return new Response(
        JSON.stringify({ error: "Invalid portfolio data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const grokApiKey = Deno.env.get("GROK_API_KEY");
    if (!grokApiKey) {
      return new Response(
        JSON.stringify({ error: "Grok API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare portfolio summary for Grok
    const topHoldings = portfolioData.holdings
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map(h => `${h.name || h.ticker} (${h.assetType || 'Unknown'}): $${h.value.toFixed(2)} (${h.percentOfPortfolio.toFixed(1)}%)`)
      .join('\n');

    const assetAllocationText = Object.entries(portfolioData.assetAllocation)
      .map(([type, value]) => `${type}: $${value.toFixed(2)} (${((value / portfolioData.totalValue) * 100).toFixed(1)}%)`)
      .join('\n');

    const riskText = portfolioData.riskMetrics
      ? `Risk Metrics:
- Sharpe Ratio: ${portfolioData.riskMetrics.sharpe?.toFixed(2) || 'N/A'}
- Sortino Ratio: ${portfolioData.riskMetrics.sortino?.toFixed(2) || 'N/A'}
- Max Drawdown: ${portfolioData.riskMetrics.mdd ? (portfolioData.riskMetrics.mdd * 100).toFixed(1) + '%' : 'N/A'}
- Beta: ${portfolioData.riskMetrics.beta?.toFixed(2) || 'N/A'}`
      : '';

    const prompt = `Analyze this investment portfolio and provide brief, actionable insights:

Total Portfolio Value: $${portfolioData.totalValue.toFixed(2)}
Number of Holdings: ${portfolioData.holdings.length}

Top Holdings:
${topHoldings}

Asset Allocation:
${assetAllocationText}

${riskText}

Please provide:
1. A brief overall assessment (2-3 sentences)
2. Key risks or concerns (2-3 bullet points)
3. Specific improvement suggestions (2-3 bullet points)

Keep the response concise, professional, and actionable. Focus on diversification, risk management, and practical recommendations.`;

    // Call Grok API
    const grokResponse = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        messages: [
          {
            role: "system",
            content: "You are a professional financial advisor providing portfolio analysis. Be concise, specific, and actionable. Avoid generic advice."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!grokResponse.ok) {
      const errorText = await grokResponse.text();
      console.error("Grok API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to get insights from Grok API" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const grokData = await grokResponse.json();
    const insights = grokData.choices?.[0]?.message?.content || "Unable to generate insights.";

    return new Response(
      JSON.stringify({
        success: true,
        insights,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-portfolio:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
