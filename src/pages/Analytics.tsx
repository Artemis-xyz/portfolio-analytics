import { useMemo, useState, useRef, useEffect } from "react";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { usePortfolioHoldings } from "@/hooks/usePortfolio";
import { use24hPrices, type TimeframeKey } from "@/hooks/use24hPrices";
import { Loader2, TrendingUp, TrendingDown, DollarSign, PieChart as PieIcon, BarChart3, Layers, ChevronDown } from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Navigate } from "react-router-dom";

const CHART_COLORS = [
  "hsl(142, 76%, 45%)",
  "hsl(217, 91%, 60%)",
  "hsl(280, 67%, 55%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 55%)",
  "hsl(180, 60%, 45%)",
  "hsl(330, 70%, 50%)",
  "hsl(60, 70%, 45%)",
];

const TIMEFRAMES: TimeframeKey[] = ["1D", "1W", "1M", "3M", "6M", "YTD"];

const formatUsd = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
};

// ─── Timeframe Dropdown ───
const TimeframeDropdown = ({
  value,
  onChange,
}: {
  value: TimeframeKey;
  onChange: (v: TimeframeKey) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 h-6 px-2 text-[11px] font-medium border border-border rounded-md bg-secondary text-foreground hover:bg-accent transition-colors"
      >
        {value}
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[72px]">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => {
                onChange(tf);
                setOpen(false);
              }}
              className={`block w-full text-left px-3 py-1 text-[11px] hover:bg-accent transition-colors ${
                tf === value ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── KPI Card ───
const KpiCard = ({
  icon: Icon,
  label,
  value,
  positive,
  prefix,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  positive?: boolean;
  prefix?: string;
}) => (
  <div className="border border-border rounded-md px-3 py-2.5">
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className="w-3 h-3 text-muted-foreground" />
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
    <span
      className={`text-[15px] font-semibold ${
        positive === undefined
          ? "text-foreground"
          : positive
            ? "text-positive"
            : "text-negative"
      }`}
    >
      {prefix}{value}
    </span>
  </div>
);

const Analytics = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: holdings, isLoading } = usePortfolioHoldings(user?.id);
  const [timeframe, setTimeframe] = useState<TimeframeKey>("1D");

  const tickers = useMemo(
    () => (holdings ?? []).map((h) => h.ticker).filter(Boolean) as string[],
    [holdings]
  );

  const { data: priceData, isLoading: pricesLoading } = use24hPrices(tickers, timeframe);

  const stats = useMemo(() => {
    if (!holdings || holdings.length === 0) return null;

    let totalValue = 0;
    let totalPnl = 0;
    let holdingsWithGain = 0;
    let holdingsWithLoss = 0;
    const byType: Record<string, number> = {};
    const byInstitution: Record<string, number> = {};
    const topHoldings: { name: string; value: number }[] = [];

    for (const h of holdings) {
      const ticker = h.ticker?.toUpperCase();
      const pd = ticker && priceData ? priceData[ticker] : null;

      // Use live price if available, otherwise fall back to stored value
      const livePrice = pd?.price ?? h.close_price;
      const currentValue = livePrice * h.quantity;
      totalValue += currentValue;

      // Calculate PNL based on timeframe
      if (pd) {
        // change is per-share, multiply by quantity for position PNL
        const positionPnl = pd.change * h.quantity;
        totalPnl += positionPnl;
        if (positionPnl >= 0) holdingsWithGain++;
        else holdingsWithLoss++;
      }

      const type = h.asset_type || "Other";
      byType[type] = (byType[type] || 0) + currentValue;

      const inst = h.institution_name || "Unknown";
      byInstitution[inst] = (byInstitution[inst] || 0) + currentValue;

      topHoldings.push({
        name: h.ticker || h.security_name.slice(0, 16),
        value: currentValue,
      });
    }

    topHoldings.sort((a, b) => b.value - a.value);

    const typeDistribution = Object.entries(byType)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const institutionDistribution = Object.entries(byInstitution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const totalPnlPct = totalValue > 0 && totalPnl !== 0
      ? (totalPnl / (totalValue - totalPnl)) * 100
      : 0;

    return {
      totalValue,
      totalHoldings: holdings.length,
      totalPnl,
      totalPnlPct,
      holdingsWithGain,
      holdingsWithLoss,
      typeDistribution,
      institutionDistribution,
      topHoldings: topHoldings.slice(0, 10),
    };
  }, [holdings, priceData, timeframe]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Page Title */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-[13px] font-medium text-foreground">Analytics</h1>
          <div className="w-px h-3.5 bg-border" />
          <p className="text-[13px] text-muted-foreground">Portfolio performance & allocation</p>
          <div className="ml-auto">
            <TimeframeDropdown value={timeframe} onChange={setTimeframe} />
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !stats ? (
          <div className="text-center py-20">
            <p className="text-[13px] text-muted-foreground">
              No holdings data yet. Link an account on the Portfolio page to get started.
            </p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <KpiCard icon={DollarSign} label="Total Value" value={formatUsd(stats.totalValue)} />
              <KpiCard icon={Layers} label="Holdings" value={stats.totalHoldings.toString()} />
              <KpiCard
                icon={TrendingUp}
                label="PNL"
                value={formatUsd(Math.abs(stats.totalPnl))}
                positive={stats.totalPnl >= 0}
                prefix={stats.totalPnl >= 0 ? "+" : "-"}
              />
              <KpiCard
                icon={BarChart3}
                label="Return %"
                value={`${stats.totalPnlPct >= 0 ? "+" : ""}${stats.totalPnlPct.toFixed(1)}%`}
                positive={stats.totalPnlPct >= 0}
              />
              <KpiCard icon={TrendingUp} label="Gaining" value={stats.holdingsWithGain.toString()} positive />
              <KpiCard icon={TrendingDown} label="Losing" value={stats.holdingsWithLoss.toString()} positive={false} />
            </div>

            {pricesLoading && (
              <div className="flex items-center gap-2 mb-4 text-[11px] text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Updating prices...
              </div>
            )}

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {/* Asset Type Pie */}
              <div className="border border-border rounded-md p-3">
                <h2 className="text-[11px] font-medium text-table-header uppercase tracking-wider mb-3">
                  Allocation by Asset Type
                </h2>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.typeDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={45}
                        strokeWidth={1}
                        stroke="hsl(var(--border))"
                      >
                        {stats.typeDistribution.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                          fontSize: "11px",
                          color: "hsl(var(--foreground))",
                        }}
                        formatter={(value: number) => formatUsd(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Holdings Bar */}
              <div className="border border-border rounded-md p-3">
                <h2 className="text-[11px] font-medium text-table-header uppercase tracking-wider mb-3">
                  Top Holdings by Value
                </h2>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.topHoldings} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                        tickLine={false}
                        angle={-35}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatUsd(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                          fontSize: "11px",
                          color: "hsl(var(--foreground))",
                        }}
                        formatter={(value: number) => formatUsd(value)}
                      />
                      <Bar dataKey="value" fill="hsl(217, 91%, 60%)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* By Institution */}
              <div className="border border-border rounded-md p-3">
                <h2 className="text-[11px] font-medium text-table-header uppercase tracking-wider mb-3">
                  Allocation by Institution
                </h2>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.institutionDistribution} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatUsd(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                          fontSize: "11px",
                          color: "hsl(var(--foreground))",
                        }}
                        formatter={(value: number) => formatUsd(value)}
                      />
                      <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                        {stats.institutionDistribution.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Analytics;
