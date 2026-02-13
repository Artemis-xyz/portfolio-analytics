import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { FactorData } from "@/hooks/useFactorAnalysis";

interface FactorExposureChartProps {
  factors: FactorData[];
}

export function FactorExposureChart({ factors }: FactorExposureChartProps) {
  const chartData = factors.map(f => ({
    name: f.factor.toUpperCase(),
    value: f.annualized_return * 100, // Convert to percentage
    raw: f.annualized_return,
  }));

  return (
    <div className="w-full">
      <h3 className="text-[11px] font-medium text-table-header uppercase tracking-wider mb-2">
        Factor Exposures (Annualized Return)
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            label={{ value: '%', angle: 0, position: 'insideLeft', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "11px",
            }}
            formatter={(value: number) => [`${value.toFixed(2)}%`, 'Return']}
            labelStyle={{ fontSize: "11px", fontWeight: 600 }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.value >= 0 ? "hsl(142, 76%, 45%)" : "hsl(0, 72%, 55%)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
