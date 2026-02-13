import { AlertCircle, TrendingUp, TrendingDown, MinusCircle } from "lucide-react";

export interface Recommendation {
  factor: string;
  current: number;
  optimal?: number;
  action: 'increase' | 'reduce' | 'maintain';
  reason: string;
  impact?: string;
}

interface FactorRecommendationsProps {
  recommendations: Recommendation[];
}

const actionIcons = {
  increase: TrendingUp,
  reduce: TrendingDown,
  maintain: MinusCircle,
};

const actionColors = {
  increase: 'text-success',
  reduce: 'text-destructive',
  maintain: 'text-muted-foreground',
};

const actionBgColors = {
  increase: 'bg-success/10 border-success/20',
  reduce: 'bg-destructive/10 border-destructive/20',
  maintain: 'bg-secondary/30 border-border',
};

export function FactorRecommendations({ recommendations }: FactorRecommendationsProps) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="bg-secondary/30 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-3 h-3 text-muted-foreground" />
          <h3 className="text-[11px] font-medium text-table-header uppercase tracking-wider">
            Recommendations
          </h3>
        </div>
        <p className="text-[10px] text-muted-foreground">
          No specific recommendations at this time. Your portfolio appears well-balanced.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-secondary/30 p-4 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-3 h-3 text-primary" />
        <h3 className="text-[11px] font-medium text-table-header uppercase tracking-wider">
          Rebalancing Recommendations
        </h3>
      </div>

      <div className="space-y-2">
        {recommendations.map((rec, i) => {
          const Icon = actionIcons[rec.action];
          const colorClass = actionColors[rec.action];
          const bgColorClass = actionBgColors[rec.action];

          return (
            <div key={i} className={`p-3 rounded border ${bgColorClass}`}>
              <div className="flex items-start gap-2">
                <Icon className={`w-3.5 h-3.5 mt-0.5 ${colorClass}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold uppercase">
                      {rec.factor}
                    </span>
                    {rec.optimal !== undefined && (
                      <span className="text-[9px] text-muted-foreground tabular-nums">
                        Current: {(rec.current * 100).toFixed(1)}% → Target: {(rec.optimal * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-foreground leading-relaxed">
                    {rec.reason}
                  </p>
                  {rec.impact && (
                    <p className="text-[9px] text-muted-foreground mt-1">
                      <strong>Expected impact:</strong> {rec.impact}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-border/50">
        <p className="text-[9px] text-muted-foreground">
          💡 <strong>Note:</strong> These recommendations are based on factor analysis of your current holdings
          and historical performance data. Consider your investment goals and risk tolerance before making changes.
        </p>
      </div>
    </div>
  );
}
