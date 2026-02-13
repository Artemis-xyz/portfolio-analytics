import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { format } from "date-fns";

interface DataPoint {
  date: string;
  fullDate: string;
  value: number;
}

interface PerformanceChartProps {
  timePeriod?: string;
  /** Real data points: array of [timestamp_ms, value_string] */
  dataPoints?: [number, string][];
}

const PerformanceChart = ({ timePeriod = "all-time", dataPoints }: PerformanceChartProps) => {
  const data: DataPoint[] = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) return [];

    // Map time period to lookback ms
    const now = Date.now();
    const lookback: Record<string, number> = {
      "1D": 24 * 60 * 60 * 1000,
      "1W": 7 * 24 * 60 * 60 * 1000,
      "1M": 30 * 24 * 60 * 60 * 1000,
      "6M": 180 * 24 * 60 * 60 * 1000,
      "all-time": Infinity,
    };
    const cutoff = lookback[timePeriod] === Infinity ? 0 : now - (lookback[timePeriod] ?? Infinity);

    const filtered = dataPoints.filter(([ts]) => ts >= cutoff);
    if (filtered.length === 0) return [];

    const useHourly = timePeriod === "1D";

    return filtered.map(([ts, val]) => {
      const d = new Date(ts);
      return {
        date: useHourly ? format(d, "HH:mm") : format(d, "MMM d"),
        fullDate: format(d, "MMM d, yyyy HH:mm"),
        value: parseFloat(val),
      };
    });
  }, [dataPoints, timePeriod]);

  if (data.length === 0) {
    return (
      <div className="h-48 w-full flex items-center justify-center">
        <span className="text-[13px] text-muted-foreground">No chart data available</span>
      </div>
    );
  }

  const formatYAxis = (value: number) => {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toFixed(0);
  };

  const tickInterval = Math.max(1, Math.floor(data.length / 6));

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "4px",
              fontSize: "12px",
            }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ""}
            formatter={(value: number) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, "Value"]}
          />
          <Line
            type="stepAfter"
            dataKey="value"
            stroke="hsl(var(--foreground))"
            strokeWidth={1}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceChart;
