import { FactorData } from "@/hooks/useFactorAnalysis";

interface FactorMetricsTableProps {
  factors: FactorData[];
}

export function FactorMetricsTable({ factors }: FactorMetricsTableProps) {
  return (
    <div className="w-full">
      <h3 className="text-[11px] font-medium text-table-header uppercase tracking-wider mb-2">
        Performance Metrics
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-table-header font-medium">Factor</th>
              <th className="text-right py-2 px-2 text-table-header font-medium">Ann. Return</th>
              <th className="text-right py-2 px-2 text-table-header font-medium">Sharpe</th>
              <th className="text-right py-2 px-2 text-table-header font-medium">Sortino</th>
              <th className="text-right py-2 px-2 text-table-header font-medium">Cum. Return</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((f, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-secondary/30">
                <td className="py-2 px-2 font-medium">{f.factor.toUpperCase()}</td>
                <td className={`text-right py-2 px-2 tabular-nums ${
                  f.annualized_return >= 0 ? 'text-success' : 'text-destructive'
                }`}>
                  {(f.annualized_return * 100).toFixed(2)}%
                </td>
                <td className="text-right py-2 px-2 tabular-nums">
                  {f.sharpe_ratio?.toFixed(2) ?? 'N/A'}
                </td>
                <td className="text-right py-2 px-2 tabular-nums">
                  {f.sortino_ratio?.toFixed(2) ?? 'N/A'}
                </td>
                <td className={`text-right py-2 px-2 tabular-nums ${
                  f.cumulative_returns >= 0 ? 'text-success' : 'text-destructive'
                }`}>
                  {(f.cumulative_returns * 100).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
