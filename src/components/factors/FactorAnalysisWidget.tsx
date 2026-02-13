import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Loader2, TrendingUp, AlertCircle } from "lucide-react";
import { useFactorAnalysis } from "@/hooks/useFactorAnalysis";
import { filterHoldingsByCategory } from "@/lib/assetTypes";
import { FactorExposureChart } from "./FactorExposureChart";
import { FactorMetricsTable } from "./FactorMetricsTable";
import { FactorRecommendations } from "./FactorRecommendations";

interface FactorAnalysisWidgetProps {
  holdings: Array<{
    ticker: string;
    quantity: number;
    asset_type: string | null;
    close_price: number;
  }>;
}

export function FactorAnalysisWidget({ holdings }: FactorAnalysisWidgetProps) {
  // Calculate holdings values for factor analysis
  const holdingsWithValues = holdings.map(h => ({
    ticker: h.ticker,
    quantity: h.quantity,
    asset_type: h.asset_type,
    value: h.close_price * h.quantity,
  }));

  const { data: factorData, isLoading, error } = useFactorAnalysis(holdingsWithValues);
  const filtered = filterHoldingsByCategory(holdingsWithValues);

  // Minimum holdings check
  const hasMinCrypto = filtered.crypto.length >= 5;
  const hasMinEquity = filtered.equity.length >= 5;
  const hasMinHoldings = holdings.length >= 5;

  if (!hasMinHoldings) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground">
            Factor analysis requires at least 5 holdings. You currently have {holdings.length}.
          </p>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
          <p className="text-[11px] text-muted-foreground">
            Computing factor exposures...
          </p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <p className="text-[11px] text-muted-foreground">
            Unable to compute factor analysis. Please try again later.
          </p>
        </div>
      </Card>
    );
  }

  if (!factorData) {
    return null;
  }

  const hasCryptoData = factorData.crypto && factorData.crypto.length > 0;
  const hasEquityData = factorData.equity && factorData.equity.length > 0;

  // Determine default tab
  const defaultTab = hasCryptoData ? 'crypto' : hasEquityData ? 'equity' : 'portfolio';

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h2 className="text-[11px] font-medium text-table-header uppercase tracking-wider">
          Factor Analysis
        </h2>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger
            value="crypto"
            disabled={!hasCryptoData}
            className="text-[10px]"
          >
            Crypto {hasMinCrypto && `(${filtered.crypto.length})`}
          </TabsTrigger>
          <TabsTrigger
            value="equity"
            disabled={!hasEquityData}
            className="text-[10px]"
          >
            Equity {hasMinEquity && `(${filtered.equity.length})`}
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="text-[10px]">
            Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crypto" className="space-y-4">
          {hasCryptoData ? (
            <>
              <FactorExposureChart factors={factorData.crypto} />
              <FactorMetricsTable factors={factorData.crypto} />
              {factorData.recommendations && factorData.recommendations.length > 0 && (
                <FactorRecommendations recommendations={factorData.recommendations} />
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-[11px] text-muted-foreground">
                {hasMinCrypto
                  ? 'No crypto factor data available'
                  : `Need at least 5 crypto holdings (currently ${filtered.crypto.length})`}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="equity" className="space-y-4">
          {hasEquityData ? (
            <>
              <FactorExposureChart factors={factorData.equity} />
              <FactorMetricsTable factors={factorData.equity} />
              {factorData.recommendations && factorData.recommendations.length > 0 && (
                <FactorRecommendations recommendations={factorData.recommendations} />
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-[11px] text-muted-foreground">
                {hasMinEquity
                  ? 'No equity factor data available'
                  : `Need at least 5 equity holdings (currently ${filtered.equity.length})`}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="portfolio" className="space-y-4">
          <div className="bg-secondary/30 p-4 rounded-lg">
            <h3 className="text-[11px] font-medium text-table-header uppercase tracking-wider mb-2">
              Portfolio Summary
            </h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {factorData.summary}
            </p>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-[10px] text-table-header uppercase">Crypto Allocation</p>
                <p className="text-[13px] font-semibold tabular-nums">
                  {filtered.stats.cryptoPercent.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {filtered.crypto.length} holdings
                </p>
              </div>
              <div>
                <p className="text-[10px] text-table-header uppercase">Equity Allocation</p>
                <p className="text-[13px] font-semibold tabular-nums">
                  {filtered.stats.equityPercent.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {filtered.equity.length} holdings
                </p>
              </div>
            </div>

            {(!hasCryptoData && !hasEquityData) && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
                <p className="text-[10px] text-yellow-600 dark:text-yellow-400">
                  ⚠️ Factor analysis is currently unavailable. This may be because the factors API is not accessible or there is insufficient data.
                </p>
              </div>
            )}
          </div>

          {/* Show recommendations in portfolio overview tab */}
          {factorData.recommendations && factorData.recommendations.length > 0 && (
            <FactorRecommendations recommendations={factorData.recommendations} />
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}
