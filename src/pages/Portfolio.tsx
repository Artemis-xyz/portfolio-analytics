import { useState, useCallback, useRef, useMemo } from "react";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { usePortfolioHoldings, useUpdateHolding, useDeleteHolding, useCreateHolding, Holding } from "@/hooks/usePortfolio";
import { use24hPrices, type TimeframeKey } from "@/hooks/use24hPrices";
import { usePortfolioInsights } from "@/hooks/usePortfolioInsights";
import { useFactorTimeSeries } from "@/hooks/useFactorTimeSeries";
import { filterHoldingsByCategory, detectAssetType } from "@/lib/assetTypes";
import { FactorAnalysisWidget } from "@/components/factors/FactorAnalysisWidget";
import { Navigate } from "react-router-dom";
import { Loader2, Trash2, Upload, FileSpreadsheet, X, Download, TrendingUp, TrendingDown, DollarSign, BarChart3, Layers, ChevronDown, Pencil, Check, Sparkles, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
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
  LineChart,
  Line,
  Legend,
} from "recharts";

const formatUsd = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
};

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

// ─── Risk Metrics Calculations ───

function calculateReturns(timeSeries: Array<{ date: string; price: number }>): number[] {
  const returns: number[] = [];
  for (let i = 1; i < timeSeries.length; i++) {
    const ret = (timeSeries[i].price - timeSeries[i - 1].price) / timeSeries[i - 1].price;
    returns.push(ret);
  }
  return returns;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function stdDev(values: number[], meanVal?: number): number {
  if (values.length === 0) return 0;
  const m = meanVal ?? mean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - m, 2));
  return Math.sqrt(mean(squaredDiffs));
}

function downsideStdDev(returns: number[], targetReturn: number = 0): number {
  const downsideReturns = returns.filter((r) => r < targetReturn).map((r) => r - targetReturn);
  if (downsideReturns.length === 0) return 0;
  return stdDev(downsideReturns, 0);
}

function calculateSharpe(returns: number[], riskFreeRate: number = 0): number {
  const meanReturn = mean(returns);
  const std = stdDev(returns, meanReturn);
  if (std === 0) return 0;
  return (meanReturn - riskFreeRate) / std;
}

function calculateSortino(returns: number[], riskFreeRate: number = 0): number {
  const meanReturn = mean(returns);
  const downStd = downsideStdDev(returns, riskFreeRate);
  if (downStd === 0) return 0;
  return (meanReturn - riskFreeRate) / downStd;
}

function calculateMaxDrawdown(timeSeries: Array<{ date: string; price: number }>): number {
  let maxDrawdown = 0;
  let peak = timeSeries[0]?.price || 0;

  for (const point of timeSeries) {
    if (point.price > peak) {
      peak = point.price;
    }
    const drawdown = (peak - point.price) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

function calculateVaR(returns: number[], confidenceLevel: number = 0.95): number {
  if (returns.length === 0) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidenceLevel) * sorted.length);
  return Math.abs(sorted[index] || 0);
}

function calculateBeta(
  assetReturns: number[],
  benchmarkReturns: number[]
): number {
  if (assetReturns.length !== benchmarkReturns.length || assetReturns.length === 0) {
    return 0;
  }

  const assetMean = mean(assetReturns);
  const benchmarkMean = mean(benchmarkReturns);

  let covariance = 0;
  let benchmarkVariance = 0;

  for (let i = 0; i < assetReturns.length; i++) {
    covariance += (assetReturns[i] - assetMean) * (benchmarkReturns[i] - benchmarkMean);
    benchmarkVariance += Math.pow(benchmarkReturns[i] - benchmarkMean, 2);
  }

  if (benchmarkVariance === 0) return 0;

  return covariance / benchmarkVariance;
}

// ─── Broker Types & Configurations ───

type BrokerType = 'manual' | 'robinhood' | 'ibkr' | 'coinbase' | 'binance';
type ParseMode = 'transactions' | 'holdings';

interface BrokerConfig {
  id: BrokerType;
  label: string;
  parseMode: ParseMode;
  note: string;
  sampleColumns: string;
}

const BROKER_CONFIGS: BrokerConfig[] = [
  {
    id: 'manual',
    label: 'Manual/Standard',
    parseMode: 'holdings',
    note: 'Use the standard CSV format with columns: name, ticker, quantity, price, value, cost_basis, type',
    sampleColumns: 'name, ticker, quantity, price, value, cost_basis, type',
  },
  {
    id: 'robinhood',
    label: 'Robinhood',
    parseMode: 'transactions',
    note: 'Export your complete trade history from Account → History → Export All. We will calculate your current holdings.',
    sampleColumns: 'Date, Ticker Symbol, Order Type, Side, Quantity, Average Price, Fees',
  },
  {
    id: 'ibkr',
    label: 'Interactive Brokers',
    parseMode: 'transactions',
    note: 'Export Activity Statement (Flex Query). We support the Trades section format.',
    sampleColumns: 'TradeDate, Symbol, Quantity, TradePrice, IBCommission',
  },
  {
    id: 'coinbase',
    label: 'Coinbase',
    parseMode: 'transactions',
    note: 'Export transaction history from Reports → Transactions. We will aggregate your current crypto holdings.',
    sampleColumns: 'Timestamp, Transaction Type, Asset, Quantity Transacted, Spot Price, Total, Fees',
  },
  {
    id: 'binance',
    label: 'Binance',
    parseMode: 'transactions',
    note: 'Export Trade History from Orders → Spot Order → Trade History → Export.',
    sampleColumns: 'Date/Time, Asset, Side (Buy/Sell), Price, Amount, Total',
  },
];

// ─── Analytics Components ───

const KpiCard = ({
  icon: Icon,
  label,
  value,
  positive,
  prefix,
}: {
  icon: any;
  label: string;
  value: string;
  positive?: boolean;
  prefix?: string;
}) => (
  <div className="border border-border rounded-md p-3">
    <div className="flex items-center gap-2 mb-1.5">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-[10px] text-table-header uppercase tracking-wider">{label}</span>
    </div>
    <p
      className={`text-[15px] font-medium tabular-nums ${
        positive === undefined
          ? "text-foreground"
          : positive
          ? "text-positive"
          : "text-negative"
      }`}
    >
      {prefix && <span className="mr-0.5">{prefix}</span>}
      {value}
    </p>
  </div>
);

const TimeframeDropdown = ({
  value,
  onChange,
}: {
  value: TimeframeKey;
  onChange: (v: TimeframeKey) => void;
}) => {
  const [open, setOpen] = useState(false);
  const timeframes: TimeframeKey[] = ["1W", "1M", "3M", "6M", "1Y", "YTD"];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium border border-border rounded-md text-foreground hover:bg-secondary transition-colors"
      >
        {value}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 py-1 bg-popover border border-border rounded-md shadow-lg z-10">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => {
                onChange(tf);
                setOpen(false);
              }}
              className={`block w-full px-3 py-1.5 text-[11px] text-left hover:bg-secondary transition-colors ${
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

// ─── CSV Parser ───

interface CsvRow {
  security_name: string;
  ticker: string | null;
  quantity: number;
  close_price: number;
  value: number;
  cost_basis: number | null;
  asset_type: string | null;
  position_direction: 'long' | 'short';
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(",").map((h) => h.trim().replace(/"/g, ""));

  // Find column indices (flexible matching)
  const nameIdx = headers.findIndex((h) => ["name", "security_name", "security", "description", "holding"].includes(h));
  const tickerIdx = headers.findIndex((h) => ["ticker", "symbol", "ticker_symbol", "code"].includes(h));
  const qtyIdx = headers.findIndex((h) => ["quantity", "qty", "shares", "units", "amount"].includes(h));
  const priceIdx = headers.findIndex((h) => ["price", "close_price", "current_price", "last_price", "market_price"].includes(h));
  const valueIdx = headers.findIndex((h) => ["value", "market_value", "total_value", "current_value"].includes(h));
  const costIdx = headers.findIndex((h) => ["cost_basis", "cost", "total_cost", "average_cost", "avg_cost"].includes(h));
  const typeIdx = headers.findIndex((h) => ["type", "asset_type", "asset_class", "category"].includes(h));
  const directionIdx = headers.findIndex((h) => ["direction", "side", "position", "position_type", "long_short"].includes(h));

  if (nameIdx === -1 && tickerIdx === -1) {
    throw new Error("CSV must have at least a 'name' or 'ticker' column");
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV split (handles basic quoting)
    const cols = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map((c) =>
      c.trim().replace(/^"|"$/g, "").trim()
    ) || line.split(",").map((c) => c.trim());

    const parseNum = (idx: number): number => {
      if (idx === -1 || !cols[idx]) return 0;
      return parseFloat(cols[idx].replace(/[$,]/g, "")) || 0;
    };

    const parseDirection = (val: string): 'long' | 'short' => {
      const lower = val.toLowerCase().trim();
      return ['short', 's', 'sell', 'sold'].includes(lower) ? 'short' : 'long';
    };

    const qty = parseNum(qtyIdx);
    const price = parseNum(priceIdx);
    const explicitValue = parseNum(valueIdx);
    const value = explicitValue > 0 ? explicitValue : qty * price;

    rows.push({
      security_name: nameIdx !== -1 ? (cols[nameIdx] || "Unknown") : (tickerIdx !== -1 ? cols[tickerIdx] : "Unknown"),
      ticker: tickerIdx !== -1 ? (cols[tickerIdx] || null) : null,
      quantity: qty,
      close_price: price,
      value,
      cost_basis: costIdx !== -1 ? (parseNum(costIdx) || null) : null,
      asset_type: typeIdx !== -1 ? (cols[typeIdx] || null) : null,
      position_direction: directionIdx !== -1 ? parseDirection(cols[directionIdx]) : 'long',
    });
  }

  return rows.filter((r) => r.security_name !== "Unknown" || r.ticker);
}

// ─── CSV Import Modal ───

const CsvImportModal = ({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (csvText: string, broker: BrokerType, parseMode: ParseMode) => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [broker, setBroker] = useState<BrokerType>('manual');
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<CsvRow[] | null>(null);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  if (!open) return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setFileName(file.name);
    setPreview(null);

    if (file.size > 5 * 1024 * 1024) {
      setError("File too large (max 5MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        setCsvText(text);

        // Only parse for preview if manual mode
        if (broker === 'manual') {
          const rows = parseCsv(text);
          if (rows.length === 0) {
            setError("No valid holdings found in CSV");
            return;
          }
          setPreview(rows);
        } else {
          // For transaction brokers, just show file loaded message
          setPreview([]); // Empty array signals ready to import
        }
      } catch (err: any) {
        setError(err.message || "Failed to parse CSV");
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const template = `name,ticker,quantity,price,value,cost_basis,type,direction
"Apple Inc",AAPL,10,185.50,1855.00,1500.00,equity,long
"Tesla Inc",TSLA,5,250.00,1250.00,1300.00,equity,short
"Bitcoin",BTC,0.5,43000.00,21500.00,20000.00,crypto,long
"Vanguard S&P 500 ETF",VOO,25,420.00,10500.00,9800.00,etf,long`;
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "portfolio_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-[520px] mx-4 border border-border rounded-lg bg-background shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-[13px] font-medium text-foreground">Import from CSV</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {!preview ? (
            <>
              {/* Broker Selection */}
              <div className="mb-4">
                <label className="text-[11px] font-medium text-table-header uppercase mb-2 block">
                  Select Broker Format
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {BROKER_CONFIGS.map((config) => (
                    <button
                      key={config.id}
                      onClick={() => {
                        setBroker(config.id);
                        setCsvText('');
                        setFileName('');
                        setPreview(null);
                        setError('');
                      }}
                      className={`px-3 py-2 text-[11px] rounded border text-left ${
                        broker === config.id
                          ? 'bg-foreground text-background border-foreground font-medium'
                          : 'bg-background text-foreground border-border hover:border-muted-foreground'
                      }`}
                    >
                      {config.label}
                      {config.parseMode === 'transactions' && (
                        <span className="block text-[9px] opacity-70 mt-0.5">Parses transaction history</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="mt-2 p-3 bg-secondary/30 rounded text-[10px] text-muted-foreground">
                  <strong>Instructions:</strong> {BROKER_CONFIGS.find(c => c.id === broker)?.note}
                  <div className="mt-2 text-[9px] opacity-80">
                    <strong>Expected columns:</strong> {BROKER_CONFIGS.find(c => c.id === broker)?.sampleColumns}
                  </div>
                </div>
              </div>

              {/* Upload area */}
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
              >
                <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-[12px] text-foreground mb-1">
                  {fileName || "Click to select a CSV file"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Max 5MB
                </p>
                {broker !== 'manual' && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-2">
                    Note: Uploading will replace previous {BROKER_CONFIGS.find(c => c.id === broker)?.label} imports
                  </p>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFile}
                  className="hidden"
                />
              </div>

              {broker === 'manual' && (
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 mt-3 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Download template CSV
                </button>
              )}

              {error && <p className="text-[11px] text-negative mt-2">{error}</p>}
            </>
          ) : (
            <>
              {/* Preview or Ready to Import */}
              {broker === 'manual' && preview.length > 0 ? (
                <>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Found <span className="text-foreground font-medium">{preview.length}</span> holdings in{" "}
                    <span className="text-foreground">{fileName}</span>
                  </p>
                  <div className="border border-border rounded-md overflow-hidden max-h-[260px] overflow-y-auto mb-3">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-secondary/50">
                          <th className="text-left text-[10px] font-medium text-table-header uppercase px-2 py-1.5">Name</th>
                          <th className="text-left text-[10px] font-medium text-table-header uppercase px-2 py-1.5">Ticker</th>
                          <th className="text-right text-[10px] font-medium text-table-header uppercase px-2 py-1.5">Qty</th>
                          <th className="text-right text-[10px] font-medium text-table-header uppercase px-2 py-1.5">Price</th>
                          <th className="text-right text-[10px] font-medium text-table-header uppercase px-2 py-1.5">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.slice(0, 20).map((r, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="text-[11px] text-foreground px-2 py-1 truncate max-w-[140px]">{r.security_name}</td>
                            <td className="text-[11px] text-foreground font-medium px-2 py-1">{r.ticker || "—"}</td>
                            <td className="text-[11px] text-foreground text-right px-2 py-1 tabular-nums">{r.quantity.toFixed(2)}</td>
                            <td className="text-[11px] text-foreground text-right px-2 py-1 tabular-nums">{formatUsd(r.close_price)}</td>
                            <td className="text-[11px] text-foreground text-right px-2 py-1 tabular-nums font-medium">{formatUsd(r.value)}</td>
                          </tr>
                        ))}
                        {preview.length > 20 && (
                          <tr>
                            <td colSpan={5} className="text-[10px] text-muted-foreground text-center py-1.5">
                              +{preview.length - 20} more rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="mb-3">
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Ready to import <span className="text-foreground font-medium">{BROKER_CONFIGS.find(c => c.id === broker)?.label}</span> transactions from{" "}
                    <span className="text-foreground">{fileName}</span>
                  </p>
                  <div className="p-3 bg-secondary/30 rounded text-[10px] text-muted-foreground">
                    The CSV will be parsed on the server to calculate your current holdings from transaction history.
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPreview(null);
                    setFileName('');
                    setCsvText('');
                  }}
                  className="px-2.5 py-1 text-[12px] border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => onImport(csvText, broker, BROKER_CONFIGS.find(c => c.id === broker)!.parseMode)}
                  className="px-2.5 py-1 text-[12px] font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
                >
                  {broker === 'manual' ? `Import ${preview.length} holdings` : 'Import & Process'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Portfolio Page ───

const Portfolio = () => {
  const { user, loading: authLoading } = useAuth();
  const [timeframe, setTimeframe] = useState<TimeframeKey>("1W");
  const [csvOpen, setCsvOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    quantity: '',
    close_price: '',
    cost_basis: '',
    position_direction: 'long' as 'long' | 'short',
  });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newHoldingForm, setNewHoldingForm] = useState({
    security_name: '',
    ticker: '',
    quantity: '',
    asset_type: '',
    position_direction: 'long' as 'long' | 'short',
  });
  const queryClient = useQueryClient();

  console.log("👤 Portfolio: user object:", user);
  console.log("🆔 Portfolio: user.id:", user?.id);

  const { data: holdings, isLoading: holdingsLoading } = usePortfolioHoldings(user?.id);
  const updateHolding = useUpdateHolding();
  const deleteHolding = useDeleteHolding();
  const createHolding = useCreateHolding();
  const tickers = useMemo(() => {
    const holdingTickers = (holdings ?? []).map((h) => h.ticker).filter(Boolean) as string[];
    // Always include benchmarks for beta calculation
    return [...new Set([...holdingTickers, 'BTC', 'SPY'])];
  }, [holdings]);
  const { data: priceData, isLoading: pricesLoading } = use24hPrices(tickers, timeframe);

  // Determine which factors to show based on portfolio composition
  const portfolioStats = useMemo(() => {
    if (!holdings || holdings.length === 0) return { cryptoPercent: 0, equityPercent: 0 };

    let cryptoValue = 0;
    let equityValue = 0;

    holdings.forEach((h) => {
      const value = h.value || 0;
      if (h.asset_type === 'Crypto') {
        cryptoValue += value;
      } else {
        equityValue += value;
      }
    });

    const totalValue = cryptoValue + equityValue;
    return {
      cryptoPercent: totalValue > 0 ? (cryptoValue / totalValue) * 100 : 0,
      equityPercent: totalValue > 0 ? (equityValue / totalValue) * 100 : 0,
    };
  }, [holdings]);

  // Fetch factor time series data
  const factorsToShow = ["smb", "market", "value", "momentum", "momentum_v2", "growth"];
  const { data: factorTimeSeriesData } = useFactorTimeSeries(
    factorsToShow,
    undefined, // Will use all available dates
    undefined,
    holdings !== undefined && holdings.length >= 3 // Only fetch if enough holdings for factor analysis
  );

  // Calculate total value and PNL using live prices when available
  const { totalValue, total24hPnl } = useMemo(() => {
    return holdings?.reduce((acc, h) => {
      const tickerUpper = h.ticker?.toUpperCase();
      const pd = tickerUpper && priceData ? priceData[tickerUpper] : null;
      const isShort = h.position_direction === 'short';
      const effectiveQuantity = h.quantity * (isShort ? -1 : 1);
      const livePrice = pd ? pd.price : null;
      const value = livePrice != null ? livePrice * effectiveQuantity : h.value;
      const pnl24h = pd ? pd.change * effectiveQuantity : 0;

      return {
        totalValue: acc.totalValue + value,
        total24hPnl: acc.total24hPnl + pnl24h,
      };
    }, { totalValue: 0, total24hPnl: 0 }) ?? { totalValue: 0, total24hPnl: 0 };
  }, [holdings, priceData]);

  const total24hPnlPct = totalValue > 0 ? (total24hPnl / (totalValue - total24hPnl)) * 100 : 0;

  // Calculate detailed stats for analytics
  const stats = useMemo(() => {
    if (!holdings || holdings.length === 0) return null;

    let holdingsWithGain = 0;
    let holdingsWithLoss = 0;
    const byType: Record<string, number> = {};
    const byInstitution: Record<string, number> = {};
    const topHoldings: { name: string; value: number }[] = [];

    for (const h of holdings) {
      const ticker = h.ticker?.toUpperCase();
      const pd = ticker && priceData ? priceData[ticker] : null;
      const isShort = h.position_direction === 'short';
      const effectiveQuantity = h.quantity * (isShort ? -1 : 1);

      const livePrice = pd?.price ?? h.close_price;
      const currentValue = livePrice * effectiveQuantity;

      if (pd) {
        const positionPnl = pd.change * effectiveQuantity;
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

    return {
      totalHoldings: holdings.length,
      holdingsWithGain,
      holdingsWithLoss,
      typeDistribution,
      institutionDistribution,
      topHoldings: topHoldings.slice(0, 10),
    };
  }, [holdings, priceData]);

  // Calculate risk metrics
  const riskMetrics = useMemo(() => {
    if (!holdings || !priceData || holdings.length === 0) {
      return { sharpe: null, sortino: null, mdd: null, var: null, beta: null };
    }

    // Build portfolio time series (value-weighted)
    const dateMap = new Map<string, number>();
    let totalValue = 0;

    holdings.forEach((h) => {
      const ticker = h.ticker?.toUpperCase();
      const pd = ticker && priceData[ticker];
      if (!pd?.timeSeries || pd.timeSeries.length === 0) return;

      const isShort = h.position_direction === 'short';
      const effectiveQuantity = h.quantity * (isShort ? -1 : 1);
      totalValue += pd.price * effectiveQuantity;

      pd.timeSeries.forEach((point) => {
        const current = dateMap.get(point.date) || 0;
        dateMap.set(point.date, current + point.price * effectiveQuantity);
      });
    });

    // Convert to sorted array
    const portfolioTimeSeries = Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date, price: value }));

    if (portfolioTimeSeries.length < 2) {
      return { sharpe: null, sortino: null, mdd: null, var: null, beta: null };
    }

    // Calculate portfolio returns
    const portfolioReturns = calculateReturns(portfolioTimeSeries);

    // Calculate metrics
    const sharpe = calculateSharpe(portfolioReturns, 0);
    const sortino = calculateSortino(portfolioReturns, 0);
    const mdd = calculateMaxDrawdown(portfolioTimeSeries);
    const var95 = calculateVaR(portfolioReturns, 0.95);

    // Calculate beta (determine benchmark based on portfolio composition)
    let beta: number | null = null;

    // Determine if portfolio is crypto-heavy or equity-heavy using normalized asset types
    const filtered = filterHoldingsByCategory(holdings.map(h => ({
      asset_type: h.asset_type,
      value: (priceData[h.ticker?.toUpperCase()]?.price || h.close_price) * h.quantity
    })));

    const isCryptoHeavy = filtered.stats.cryptoPercent > 50;
    const benchmarkTicker = isCryptoHeavy ? 'BTC' : 'SPY';

    const benchmarkData = priceData[benchmarkTicker];
    if (benchmarkData?.timeSeries && benchmarkData.timeSeries.length > 0) {
      const benchmarkReturns = calculateReturns(benchmarkData.timeSeries);

      // Align returns to same dates
      const alignedPortfolioReturns: number[] = [];
      const alignedBenchmarkReturns: number[] = [];

      const minLength = Math.min(portfolioReturns.length, benchmarkReturns.length);
      for (let i = 0; i < minLength; i++) {
        alignedPortfolioReturns.push(portfolioReturns[i]);
        alignedBenchmarkReturns.push(benchmarkReturns[i]);
      }

      beta = calculateBeta(alignedPortfolioReturns, alignedBenchmarkReturns);
    }

    return { sharpe, sortino, mdd, var: var95, beta };
  }, [holdings, priceData]);

  // Calculate portfolio vs benchmark comparison data
  const comparisonChartData = useMemo(() => {
    if (!holdings || !priceData || holdings.length === 0) {
      return [];
    }

    // Build portfolio time series (value-weighted)
    const dateMap = new Map<string, number>();

    holdings.forEach((h) => {
      const ticker = h.ticker?.toUpperCase();
      const pd = ticker && priceData[ticker];
      if (!pd?.timeSeries || pd.timeSeries.length === 0) return;

      const isShort = h.position_direction === 'short';
      const effectiveQuantity = h.quantity * (isShort ? -1 : 1);

      pd.timeSeries.forEach((point) => {
        const current = dateMap.get(point.date) || 0;
        dateMap.set(point.date, current + point.price * effectiveQuantity);
      });
    });

    // Get all unique dates from portfolio, SPY, and BTC
    const allDates = new Set<string>();
    dateMap.forEach((_, date) => allDates.add(date));

    const spyData = priceData['SPY'];
    const btcData = priceData['BTC'];

    if (spyData?.timeSeries) {
      spyData.timeSeries.forEach((point) => allDates.add(point.date));
    }
    if (btcData?.timeSeries) {
      btcData.timeSeries.forEach((point) => allDates.add(point.date));
    }

    // Sort dates
    const sortedDates = Array.from(allDates).sort();

    // Create maps for SPY and BTC
    const spyMap = new Map(spyData?.timeSeries?.map((p) => [p.date, p.price]) || []);
    const btcMap = new Map(btcData?.timeSeries?.map((p) => [p.date, p.price]) || []);

    // Build time series with all three
    const rawData: Array<{ date: string; portfolio: number | null; spy: number | null; btc: number | null }> = [];

    for (const date of sortedDates) {
      rawData.push({
        date,
        portfolio: dateMap.get(date) || null,
        spy: spyMap.get(date) || null,
        btc: btcMap.get(date) || null,
      });
    }

    // Forward-fill missing values
    let lastPortfolio = null;
    let lastSpy = null;
    let lastBtc = null;

    const filledData = rawData.map((point) => {
      if (point.portfolio !== null) lastPortfolio = point.portfolio;
      if (point.spy !== null) lastSpy = point.spy;
      if (point.btc !== null) lastBtc = point.btc;

      return {
        date: point.date,
        portfolio: lastPortfolio,
        spy: lastSpy,
        btc: lastBtc,
      };
    });

    // Filter to only dates where we have all three values
    const completeData = filledData.filter((p) => p.portfolio !== null && p.spy !== null && p.btc !== null);

    if (completeData.length === 0) return [];

    // Normalize to start at 100
    const firstPoint = completeData[0];
    const portfolioBase = firstPoint.portfolio!;
    const spyBase = firstPoint.spy!;
    const btcBase = firstPoint.btc!;

    const normalizedData = completeData.map((point) => ({
      date: point.date,
      Portfolio: ((point.portfolio! / portfolioBase) * 100),
      SPY: ((point.spy! / spyBase) * 100),
      BTC: ((point.btc! / btcBase) * 100),
    }));

    // Add factor data if available
    if (factorTimeSeriesData) {
      // Get all unique dates from factors
      const factorDates = new Set<string>();
      Object.values(factorTimeSeriesData).forEach((factorData) => {
        factorData.dates.forEach((d) => factorDates.add(d));
      });

      // Merge factor dates into existing dates
      const allDatesWithFactors = new Set([...normalizedData.map(p => p.date), ...factorDates]);
      const sortedAllDates = Array.from(allDatesWithFactors).sort();

      // Create factor maps
      const factorMaps = new Map<string, Map<string, number>>();
      for (const [factorName, factorData] of Object.entries(factorTimeSeriesData)) {
        const factorMap = new Map<string, number>();
        factorData.dates.forEach((date, idx) => {
          factorMap.set(date, factorData.cumulative_returns[idx]);
        });
        factorMaps.set(factorName, factorMap);
      }

      // Build output with factors
      const output: any[] = [];
      const portfolioMap = new Map(normalizedData.map(p => [p.date, p]));

      for (const date of sortedAllDates) {
        const portfolioPoint = portfolioMap.get(date);
        if (!portfolioPoint) continue; // Only include dates where we have portfolio data

        const point: any = { ...portfolioPoint };

        // Add factor values
        for (const [factorName, factorMap] of factorMaps.entries()) {
          const factorValue = factorMap.get(date);
          if (factorValue !== undefined) {
            point[factorName] = factorValue;
          } else {
            // Forward-fill: use last known value
            const prevDate = Array.from(factorMap.keys()).reverse().find(d => d < date);
            point[factorName] = prevDate ? factorMap.get(prevDate)! : null;
          }
        }

        output.push(point);
      }

      return output;
    }

    return normalizedData;
  }, [holdings, priceData, factorTimeSeriesData]);

  // Prepare portfolio data for AI insights
  const portfolioDataForInsights = useMemo(() => {
    if (!holdings || holdings.length === 0 || !stats) return null;

    const holdingsData = holdings.map((h) => {
      const ticker = h.ticker?.toUpperCase();
      const pd = ticker && priceData ? priceData[ticker] : null;
      const livePrice = pd?.price ?? h.close_price;
      const currentValue = livePrice * h.quantity;

      return {
        name: h.security_name,
        ticker: h.ticker,
        quantity: h.quantity,
        value: currentValue,
        assetType: h.asset_type,
        percentOfPortfolio: (currentValue / totalValue) * 100,
      };
    });

    const assetAllocation: Record<string, number> = {};
    stats.typeDistribution.forEach((item) => {
      assetAllocation[item.name] = item.value;
    });

    return {
      totalValue,
      holdings: holdingsData,
      assetAllocation,
      riskMetrics: riskMetrics.sharpe !== null ? riskMetrics : undefined,
    };
  }, [holdings, stats, priceData, totalValue, riskMetrics]);

  // Fetch AI insights
  const { data: insightsData, isLoading: insightsLoading, error: insightsError, refetch: refetchInsights } = usePortfolioInsights(
    portfolioDataForInsights,
    holdings !== undefined && holdings.length > 0
  );

  const handleStartEdit = (holding: Holding) => {
    setEditingId(holding.id);
    setEditForm({
      quantity: holding.quantity.toString(),
      close_price: holding.close_price.toString(),
      cost_basis: holding.cost_basis?.toString() || '',
      position_direction: holding.position_direction || 'long',
    });
  };

  const handleSaveEdit = async (holdingId: string) => {
    if (!user) return;

    try {
      const updates: any = {};
      if (editForm.quantity) updates.quantity = parseFloat(editForm.quantity);
      if (editForm.close_price) updates.close_price = parseFloat(editForm.close_price);
      if (editForm.cost_basis) updates.cost_basis = parseFloat(editForm.cost_basis);
      if (editForm.position_direction) updates.position_direction = editForm.position_direction;

      // Recalculate value
      if (updates.quantity !== undefined && updates.close_price !== undefined) {
        updates.value = updates.quantity * updates.close_price;
      }

      await updateHolding.mutateAsync({
        holdingId,
        updates,
        userId: user.id,
      });

      toast.success('Holding updated');
      setEditingId(null);
      setEditForm({ quantity: '', close_price: '', cost_basis: '', position_direction: 'long' });
    } catch (err: any) {
      console.error('Update error:', err);
      toast.error(err.message || 'Failed to update holding');
    }
  };

  const handleDeleteHolding = async (holdingId: string) => {
    if (!user) return;

    if (!confirm('Are you sure you want to delete this holding?')) {
      return;
    }

    try {
      await deleteHolding.mutateAsync({
        holdingId,
        userId: user.id,
      });

      toast.success('Holding deleted');
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err.message || 'Failed to delete holding');
    }
  };

  const handleStartAddNew = () => {
    setIsAddingNew(true);
    setNewHoldingForm({
      security_name: '',
      ticker: '',
      quantity: '',
      asset_type: '',
    });
  };

  const handleCancelAddNew = () => {
    setIsAddingNew(false);
    setNewHoldingForm({
      security_name: '',
      ticker: '',
      quantity: '',
      asset_type: '',
    });
  };

  const handleSaveNew = async () => {
    if (!user) return;

    // Validation
    if (!newHoldingForm.security_name.trim()) {
      toast.error('Asset name is required');
      return;
    }
    if (!newHoldingForm.ticker.trim()) {
      toast.error('Ticker symbol is required');
      return;
    }
    if (!newHoldingForm.quantity || parseFloat(newHoldingForm.quantity) <= 0) {
      toast.error('Valid quantity is required');
      return;
    }

    // Get price from API
    const ticker = newHoldingForm.ticker.trim().toUpperCase();
    let price = 0;

    // Check if prices are still loading
    if (pricesLoading) {
      toast.error('Loading price data... Please wait a moment and try again.');
      return;
    }

    if (priceData && priceData[ticker]) {
      price = priceData[ticker].price;
    }

    if (price <= 0) {
      toast.error(`Unable to fetch price for ${ticker}. This might be due to:\n• Invalid ticker symbol\n• Market data not available\n• API rate limits\n\nPlease verify the ticker and try again.`);
      return;
    }

    // Check for duplicate holdings
    const duplicate = holdings?.find(h =>
      h.ticker?.toUpperCase() === ticker &&
      h.position_direction === newHoldingForm.position_direction
    );

    if (duplicate) {
      toast.error(
        `You already have a ${newHoldingForm.position_direction} position in ${ticker}. ` +
        `Edit the existing holding to adjust quantity or other details.`
      );
      return;
    }

    try {
      // Auto-detect asset type if not provided
      const assetType = newHoldingForm.asset_type.trim() ||
                       detectAssetType(ticker, newHoldingForm.security_name.trim());

      await createHolding.mutateAsync({
        holding: {
          security_name: newHoldingForm.security_name.trim(),
          ticker: ticker,
          quantity: parseFloat(newHoldingForm.quantity),
          close_price: price,
          cost_basis: null,
          asset_type: assetType,
          position_direction: newHoldingForm.position_direction,
        },
        userId: user.id,
      });

      toast.success('Asset added successfully');
      setIsAddingNew(false);
      setNewHoldingForm({
        security_name: '',
        ticker: '',
        quantity: '',
        asset_type: '',
        position_direction: 'long' as 'long' | 'short',
      });
    } catch (err: any) {
      console.error('Create error:', err);
      toast.error(err.message || 'Failed to add asset');
    }
  };

  const handleCsvImport = useCallback(async (csvText: string, broker: BrokerType, parseMode: ParseMode) => {
    if (!user) return;
    setImporting(true);
    setCsvOpen(false);

    try {
      let requestBody: any;

      if (parseMode === 'holdings') {
        // Parse CSV for manual holdings
        const rows = parseCsv(csvText);
        const holdings = rows.map((r) => ({
          security_name: r.security_name.slice(0, 200),
          ticker: r.ticker?.slice(0, 20) || null,
          quantity: r.quantity,
          close_price: r.close_price,
          value: r.value,
          cost_basis: r.cost_basis,
          asset_type: r.asset_type?.slice(0, 50) || null,
          institution_name: "CSV Import",
          position_direction: r.position_direction,
        }));

        requestBody = {
          broker: 'manual',
          data: JSON.stringify(holdings),
          parseMode: 'holdings',
        };
      } else {
        // Send raw CSV text for transaction parsing on server
        requestBody = {
          broker,
          data: csvText,
          parseMode: 'transactions',
        };
      }

      console.log('📤 Invoking import-csv-holdings with:', {
        broker,
        parseMode,
        privyUserId: user.id,
        dataType: typeof requestBody.data,
        dataLength: requestBody.data.length,
        holdingsCount: parseMode === 'holdings' ? JSON.parse(requestBody.data).length : 'N/A'
      });

      const { data, error } = await supabase.functions.invoke('import-csv-holdings', {
        body: requestBody,
        headers: {
          'privy-user-id': user.id,
        },
      });

      console.log('📥 Edge function response:', { data, error });

      if (error) {
        console.error('📥 Edge function response:', { data, error });

        // Try to extract structured error from response
        let errorMessage = 'Failed to import CSV';
        let errorCode = 'UNKNOWN';

        if (error.message) {
          errorMessage = error.message;
        }

        // If data contains structured error info, extract it
        if (data?.errorCode) {
          errorCode = data.errorCode;
          errorMessage = data.error || errorMessage;
        }

        // Map error codes to user-friendly messages
        const errorMessages: Record<string, string> = {
          MISSING_PRIVY_USER_ID: 'Authentication error. Please log out and log back in.',
          INVALID_REQUEST_BODY: 'Invalid CSV format. Please check your file.',
          EMPTY_HOLDINGS: 'No holdings found in the CSV file.',
          CSV_PARSE_ERROR: 'Failed to parse CSV file. Please verify the format matches the selected broker.',
          ENV_VARS_MISSING: 'Server configuration error. Please contact support.',
          USER_LOOKUP_ERROR: 'Failed to lookup user account. Please try again.',
          USER_CREATE_ERROR: 'Failed to create user account. Please try again or contact support.',
          MAPPING_CREATE_ERROR: 'Failed to create user mapping. Please contact support.',
          INSERT_ERROR: 'Failed to save holdings. Please try again.',
          UNKNOWN_ERROR: 'An unknown error occurred. Please try again.',
        };

        // Show user-friendly message
        toast.error(errorMessages[errorCode] || errorMessage);

        // Log full details for debugging
        console.error('Full error details:', { error, data, requestBody, errorCode });

        return;
      }

      if (!data?.success) {
        console.error('Import failed:', data);
        const errorMsg = data?.error || 'Import failed';
        toast.error(errorMsg);
        return;
      }

      const brokerLabel = BROKER_CONFIGS.find(c => c.id === broker)?.label || broker;
      const count = data.count || 0;

      if (parseMode === 'transactions') {
        toast.success(`Processed transactions and imported ${count} holdings from ${brokerLabel}`);
      } else {
        toast.success(`Imported ${count} holdings from ${brokerLabel}`);
      }

      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      // Trigger insights refresh after successful import
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["portfolio-insights"] });
      }, 1000); // Small delay to ensure holdings are loaded first
    } catch (err: any) {
      console.error('CSV import error:', err);
      toast.error(err.message || "Failed to import CSV");
    } finally {
      setImporting(false);
    }
  }, [user, queryClient]);


  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const isLoading = holdingsLoading;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Page Title */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[13px] font-medium text-foreground">Portfolio</h1>
            <div className="w-px h-3.5 bg-border" />
            <p className="text-[13px] text-muted-foreground">
              Total Value: <span className="text-foreground font-medium">{formatUsd(totalValue)}</span>
            </p>
            {total24hPnl !== 0 && (
              <>
                <div className="w-px h-3.5 bg-border" />
                <p className="text-[13px] text-muted-foreground">
                  P&L:{" "}
                  <span className={`font-medium ${total24hPnl >= 0 ? "text-positive" : "text-negative"}`}>
                    {total24hPnl >= 0 ? "+" : ""}{formatUsd(total24hPnl)}{" "}
                    <span className="text-[11px]">
                      ({total24hPnl >= 0 ? "+" : ""}{total24hPnlPct.toFixed(2)}%)
                    </span>
                  </span>
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCsvOpen(true)}
              disabled={importing}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              Upload CSV
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Holdings Table */}
            {holdings && holdings.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[11px] font-medium text-table-header uppercase tracking-wider">
                    Holdings
                  </h2>
                  <button
                    onClick={handleStartAddNew}
                    disabled={isAddingNew}
                    className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium border border-border rounded-md text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3" />
                    Add New
                  </button>
                </div>
                <div className="border border-border rounded-md overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">Name</th>
                        <th className="text-left text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">Ticker</th>
                        <th className="text-right text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">Qty</th>
                        <th className="text-right text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">Price</th>
                        <th className="text-right text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">Value</th>
                        <th className="text-right text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">PNL</th>
                        <th className="text-left text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">Type</th>
                        <th className="text-left text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">Direction</th>
                        <th className="text-left text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">Broker</th>
                        <th className="text-center text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {/* Add New Row */}
                      {isAddingNew && (
                        <tr className="bg-secondary/20">
                          {/* Name */}
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              placeholder="Apple Inc"
                              value={newHoldingForm.security_name}
                              onChange={(e) => setNewHoldingForm({ ...newHoldingForm, security_name: e.target.value })}
                              className="w-full px-2 py-1 text-[11px] border border-border rounded bg-background"
                              autoFocus
                            />
                          </td>

                          {/* Ticker */}
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              placeholder="AAPL"
                              value={newHoldingForm.ticker}
                              onChange={(e) => setNewHoldingForm({ ...newHoldingForm, ticker: e.target.value.toUpperCase() })}
                              className="w-20 px-2 py-1 text-[11px] border border-border rounded bg-background"
                            />
                          </td>

                          {/* Quantity */}
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              step="0.0001"
                              placeholder="10"
                              value={newHoldingForm.quantity}
                              onChange={(e) => setNewHoldingForm({ ...newHoldingForm, quantity: e.target.value })}
                              className="w-20 px-2 py-1 text-[11px] text-right border border-border rounded bg-background"
                            />
                          </td>

                          {/* Price (API-fetched) */}
                          <td className="text-right px-3 py-1.5">
                            <span className="text-[11px] text-muted-foreground tabular-nums flex items-center justify-end gap-1">
                              {(() => {
                                const ticker = newHoldingForm.ticker.trim().toUpperCase();
                                if (pricesLoading && ticker.length >= 2) {
                                  return <><Loader2 className="w-3 h-3 animate-spin" /> Loading...</>;
                                }
                                if (ticker && priceData && priceData[ticker]) {
                                  return formatUsd(priceData[ticker].price);
                                }
                                return ticker.length >= 2 ? 'Enter ticker' : '—';
                              })()}
                            </span>
                          </td>

                          {/* Value (calculated) */}
                          <td className="text-right px-3 py-1.5">
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {(() => {
                                const ticker = newHoldingForm.ticker.trim().toUpperCase();
                                const qty = parseFloat(newHoldingForm.quantity);
                                if (qty > 0 && ticker && priceData && priceData[ticker]) {
                                  return formatUsd(qty * priceData[ticker].price);
                                }
                                return '—';
                              })()}
                            </span>
                          </td>


                          {/* PNL */}
                          <td className="text-right px-3 py-1.5">
                            <span className="text-[11px] text-muted-foreground">—</span>
                          </td>

                          {/* Type */}
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              placeholder="equity"
                              value={newHoldingForm.asset_type}
                              onChange={(e) => setNewHoldingForm({ ...newHoldingForm, asset_type: e.target.value })}
                              className="w-24 px-2 py-1 text-[11px] border border-border rounded bg-background"
                            />
                          </td>

                          {/* Direction */}
                          <td className="px-3 py-1.5">
                            <select
                              value={newHoldingForm.position_direction}
                              onChange={(e) => setNewHoldingForm({ ...newHoldingForm, position_direction: e.target.value as 'long' | 'short' })}
                              className="w-20 px-2 py-1 text-[11px] border border-border rounded bg-background"
                            >
                              <option value="long">Long</option>
                              <option value="short">Short</option>
                            </select>
                          </td>

                          {/* Broker */}
                          <td className="text-[11px] text-muted-foreground px-3 py-1.5">
                            Manual Entry
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-1.5">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={handleSaveNew}
                                disabled={createHolding.isPending || pricesLoading}
                                className="p-1 text-positive hover:bg-positive/10 rounded disabled:opacity-50"
                                title={pricesLoading ? "Loading prices..." : "Save"}
                              >
                                {createHolding.isPending || pricesLoading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={handleCancelAddNew}
                                disabled={createHolding.isPending}
                                className="p-1 text-muted-foreground hover:bg-secondary/50 rounded disabled:opacity-50"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {holdings.map((h) => {
                        const isEditing = editingId === h.id;
                        const tickerUpper = h.ticker?.toUpperCase() || "";
                        const pd = tickerUpper && priceData ? priceData[tickerUpper] : null;
                        const isShort = h.position_direction === 'short';
                        const effectiveQuantity = h.quantity * (isShort ? -1 : 1);
                        const pnlPct = pd ? pd.changePct : null;
                        const pnlDollar = pd ? pd.change * effectiveQuantity : null;
                        const livePrice = pd ? pd.price : null;
                        const currentValue = livePrice != null ? livePrice * effectiveQuantity : h.value;

                        return (
                          <tr key={h.id} className={`hover:bg-secondary/20 transition-colors ${h.position_direction === 'short' ? 'border-l-2 border-l-amber-500' : ''}`}>
                            {/* Name */}
                            <td className="px-3 py-1.5">
                              <div className="flex flex-col">
                                <span className="text-[11px] font-medium text-foreground truncate max-w-[180px]">
                                  {h.security_name}
                                </span>
                              </div>
                            </td>

                            {/* Ticker */}
                            <td className="text-[11px] text-muted-foreground px-3 py-1.5">
                              {h.ticker || "—"}
                            </td>

                            {/* Quantity (editable) */}
                            <td className="text-right px-3 py-1.5">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.0001"
                                  value={editForm.quantity}
                                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                                  className="w-20 px-1 py-0.5 text-[11px] text-right border border-border rounded bg-background"
                                />
                              ) : (
                                <span className="text-[11px] text-foreground tabular-nums">{h.quantity.toFixed(4)}</span>
                              )}
                            </td>

                            {/* Price (editable) */}
                            <td className="text-right px-3 py-1.5">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editForm.close_price}
                                  onChange={(e) => setEditForm({ ...editForm, close_price: e.target.value })}
                                  className="w-24 px-1 py-0.5 text-[11px] text-right border border-border rounded bg-background"
                                />
                              ) : (
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                  {formatUsd(livePrice || h.close_price)}
                                </span>
                              )}
                            </td>

                            {/* Value (calculated) */}
                            <td className="text-right px-3 py-1.5">
                              <span className="text-[11px] font-medium text-foreground tabular-nums">
                                {formatUsd(currentValue)}
                              </span>
                            </td>


                            {/* PNL */}
                            <td className="text-right px-3 py-1.5 tabular-nums">
                              {pnlDollar != null && pnlPct != null ? (
                                <span className={`text-[11px] ${pnlDollar >= 0 ? "text-positive" : "text-negative"}`}>
                                  {pnlDollar >= 0 ? "+" : ""}{formatUsd(pnlDollar)}{" "}
                                  <span className="text-[10px]">
                                    ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
                                  </span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">—</span>
                              )}
                            </td>

                            {/* Type */}
                            <td className="text-[11px] text-muted-foreground px-3 py-1.5">
                              {h.asset_type || "—"}
                            </td>

                            {/* Direction */}
                            <td className="px-3 py-1.5">
                              {isEditing ? (
                                <select
                                  value={editForm.position_direction}
                                  onChange={(e) => setEditForm({ ...editForm, position_direction: e.target.value as 'long' | 'short' })}
                                  className="w-20 px-2 py-1 text-[11px] border border-border rounded bg-background"
                                >
                                  <option value="long">Long</option>
                                  <option value="short">Short</option>
                                </select>
                              ) : (
                                <span className={`text-[11px] px-2 py-0.5 rounded ${
                                  h.position_direction === 'short'
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500'
                                    : 'text-muted-foreground'
                                }`}>
                                  {h.position_direction === 'short' ? 'Short' : 'Long'}
                                </span>
                              )}
                            </td>

                            {/* Broker */}
                            <td className="text-[11px] text-muted-foreground px-3 py-1.5">
                              {h.broker_source || h.institution_name || "—"}
                            </td>

                            {/* Actions */}
                            <td className="px-3 py-1.5">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleSaveEdit(h.id)}
                                    className="p-1 text-positive hover:bg-positive/10 rounded"
                                    title="Save"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditForm({ quantity: '', close_price: '', cost_basis: '', position_direction: 'long' });
                                    }}
                                    className="p-1 text-muted-foreground hover:bg-secondary/50 rounded"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleStartEdit(h)}
                                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded"
                                    title="Edit"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteHolding(h.id)}
                                    className="p-1 text-muted-foreground hover:text-negative hover:bg-negative/10 rounded"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-[13px] text-muted-foreground mb-4">
                  No holdings yet. Add assets manually or import from CSV.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={handleStartAddNew}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
                  >
                    <Plus className="w-3 h-3" />
                    Add Manually
                  </button>
                  <button
                    onClick={() => setCsvOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium border border-border rounded-md text-foreground hover:bg-secondary transition-colors"
                  >
                    <Upload className="w-3 h-3" />
                    Upload CSV
                  </button>
                </div>

                {/* Add New Form for Empty State */}
                {isAddingNew && (
                  <div className="mt-8 max-w-2xl mx-auto border border-border rounded-md p-4">
                    <h3 className="text-[12px] font-medium text-foreground mb-3">Add New Asset</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-table-header uppercase block mb-1">Name *</label>
                        <input
                          type="text"
                          placeholder="Apple Inc"
                          value={newHoldingForm.security_name}
                          onChange={(e) => setNewHoldingForm({ ...newHoldingForm, security_name: e.target.value })}
                          className="w-full px-2 py-1.5 text-[11px] border border-border rounded bg-background"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-table-header uppercase block mb-1">Ticker</label>
                        <input
                          type="text"
                          placeholder="AAPL"
                          value={newHoldingForm.ticker}
                          onChange={(e) => setNewHoldingForm({ ...newHoldingForm, ticker: e.target.value.toUpperCase() })}
                          className="w-full px-2 py-1.5 text-[11px] border border-border rounded bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-table-header uppercase block mb-1">Quantity *</label>
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="10"
                          value={newHoldingForm.quantity}
                          onChange={(e) => setNewHoldingForm({ ...newHoldingForm, quantity: e.target.value })}
                          className="w-full px-2 py-1.5 text-[11px] border border-border rounded bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-table-header uppercase block mb-1">Price (Auto-fetched)</label>
                        <div className="w-full px-2 py-1.5 text-[11px] border border-border rounded bg-secondary/30 text-foreground flex items-center gap-2">
                          {(() => {
                            const ticker = newHoldingForm.ticker.trim().toUpperCase();
                            if (pricesLoading && ticker.length >= 2) {
                              return <><Loader2 className="w-3 h-3 animate-spin" /> Loading price data...</>;
                            }
                            if (ticker && priceData && priceData[ticker]) {
                              return formatUsd(priceData[ticker].price);
                            }
                            return ticker.length >= 2 ? 'Enter valid ticker' : '—';
                          })()}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-table-header uppercase block mb-1">Asset Type</label>
                        <input
                          type="text"
                          placeholder="equity, crypto, etf"
                          value={newHoldingForm.asset_type}
                          onChange={(e) => setNewHoldingForm({ ...newHoldingForm, asset_type: e.target.value })}
                          className="w-full px-2 py-1.5 text-[11px] border border-border rounded bg-background"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <button
                        onClick={handleSaveNew}
                        disabled={createHolding.isPending || pricesLoading}
                        className="px-3 py-1.5 text-[12px] font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {createHolding.isPending ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Adding...
                          </span>
                        ) : pricesLoading ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading prices...
                          </span>
                        ) : (
                          'Add Asset'
                        )}
                      </button>
                      <button
                        onClick={handleCancelAddNew}
                        disabled={createHolding.isPending}
                        className="px-3 py-1.5 text-[12px] border border-border rounded-md text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Analytics Section */}
            {holdings && holdings.length > 0 && stats && (
              <div className="mt-8 space-y-6">
                {/* Section Header */}
                <div className="flex items-center justify-end border-b border-border pb-2">
                  <TimeframeDropdown value={timeframe} onChange={setTimeframe} />
                </div>

                {pricesLoading && (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Updating prices...
                  </div>
                )}

                {/* Performance Comparison Chart */}
                {comparisonChartData.length > 0 && (
                  <div className="border border-border rounded-md p-3">
                    <h2 className="text-[11px] font-medium text-table-header uppercase tracking-wider mb-2">
                      Portfolio Performance vs Benchmarks{factorTimeSeriesData && Object.keys(factorTimeSeriesData).length > 0 && ` & Factors (${portfolioStats.cryptoPercent > 50 ? 'Crypto' : 'Equity'})`}
                    </h2>
                    <p className="text-[10px] text-muted-foreground mb-3">
                      Normalized to 100.{factorTimeSeriesData && Object.keys(factorTimeSeriesData).length > 0 && ` Showing ${Object.keys(factorTimeSeriesData).length} factor time series.`}
                    </p>
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={comparisonChartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                            axisLine={{ stroke: "hsl(var(--border))" }}
                            tickLine={false}
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            }}
                            minTickGap={40}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                            axisLine={false}
                            tickLine={false}
                            domain={['auto', 'auto']}
                            tickFormatter={(value) => value.toFixed(0)}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                              fontSize: "11px",
                              color: "hsl(var(--foreground))",
                            }}
                            labelFormatter={(label) => {
                              const date = new Date(label);
                              return date.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              });
                            }}
                            formatter={(value: number) => value.toFixed(2)}
                          />
                          <Legend
                            wrapperStyle={{
                              fontSize: "11px",
                              paddingTop: "8px",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="Portfolio"
                            stroke="hsl(142, 76%, 45%)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="SPY"
                            stroke="hsl(217, 91%, 60%)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="BTC"
                            stroke="hsl(38, 92%, 50%)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                          {/* Factor Lines - only show if data available */}
                          {factorTimeSeriesData && Object.keys(factorTimeSeriesData).map((factorName, idx) => {
                            // Color scheme for factors (6 distinct colors)
                            const factorColors = [
                              "hsl(280, 67%, 55%)",  // purple - SMB
                              "hsl(0, 72%, 55%)",     // red - Market
                              "hsl(180, 60%, 45%)",   // cyan - Value
                              "hsl(330, 70%, 50%)",   // pink - Momentum
                              "hsl(60, 70%, 45%)",    // yellow-green - Momentum V2
                              "hsl(200, 80%, 50%)",   // light blue - Growth
                            ];

                            return (
                              <Line
                                key={factorName}
                                type="monotone"
                                dataKey={factorName}
                                stroke={factorColors[idx % factorColors.length]}
                                strokeWidth={1.5}
                                strokeOpacity={0.8}
                                dot={false}
                                activeDot={{ r: 3 }}
                                name={factorName.replace('_', ' ').toUpperCase()}
                              />
                            );
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* KPI Cards Row 1 */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KpiCard icon={DollarSign} label="Total Value" value={formatUsd(totalValue)} />
                  <KpiCard icon={Layers} label="Holdings" value={stats.totalHoldings.toString()} />
                  <KpiCard
                    icon={TrendingUp}
                    label="PNL"
                    value={formatUsd(Math.abs(total24hPnl))}
                    positive={total24hPnl >= 0}
                    prefix={total24hPnl >= 0 ? "+" : "-"}
                  />
                  <KpiCard
                    icon={BarChart3}
                    label="Return %"
                    value={`${total24hPnlPct >= 0 ? "+" : ""}${total24hPnlPct.toFixed(1)}%`}
                    positive={total24hPnlPct >= 0}
                  />
                  <KpiCard icon={TrendingUp} label="Gaining" value={stats.holdingsWithGain.toString()} positive />
                  <KpiCard icon={TrendingDown} label="Losing" value={stats.holdingsWithLoss.toString()} positive={false} />
                </div>

                {/* KPI Cards Row 2 - Risk Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <KpiCard
                    icon={BarChart3}
                    label="Sharpe"
                    value={riskMetrics.sharpe !== null ? riskMetrics.sharpe.toFixed(2) : "N/A"}
                    positive={riskMetrics.sharpe !== null && riskMetrics.sharpe > 0}
                  />
                  <KpiCard
                    icon={BarChart3}
                    label="Sortino"
                    value={riskMetrics.sortino !== null ? riskMetrics.sortino.toFixed(2) : "N/A"}
                    positive={riskMetrics.sortino !== null && riskMetrics.sortino > 0}
                  />
                  <KpiCard
                    icon={TrendingDown}
                    label="MDD"
                    value={riskMetrics.mdd !== null ? `${(riskMetrics.mdd * 100).toFixed(1)}%` : "N/A"}
                    positive={false}
                  />
                  <KpiCard
                    icon={BarChart3}
                    label="VaR (95%)"
                    value={riskMetrics.var !== null ? `${(riskMetrics.var * 100).toFixed(1)}%` : "N/A"}
                    positive={false}
                  />
                  <KpiCard
                    icon={BarChart3}
                    label="Beta"
                    value={riskMetrics.beta !== null ? riskMetrics.beta.toFixed(2) : "N/A"}
                  />
                </div>

                {/* AI Portfolio Insights */}
                <div className="border border-border rounded-md p-4 bg-gradient-to-br from-secondary/30 to-secondary/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <h2 className="text-[11px] font-medium text-table-header uppercase tracking-wider">
                        AI Portfolio Insights
                      </h2>
                    </div>
                    {!insightsLoading && holdings && holdings.length > 0 && (
                      <button
                        onClick={() => {
                          queryClient.invalidateQueries({ queryKey: ["portfolio-insights"] });
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-secondary/50"
                        title="Refresh insights"
                      >
                        <Sparkles className="w-3 h-3" />
                        Refresh
                      </button>
                    )}
                  </div>

                  {insightsLoading ? (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-4">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Analyzing your portfolio with AI...
                    </div>
                  ) : insightsError ? (
                    <div className="text-[11px] text-muted-foreground py-2">
                      <p className="text-amber-600 dark:text-amber-500">
                        Unable to generate insights. Please check your Grok API configuration.
                      </p>
                    </div>
                  ) : insightsData?.insights ? (
                    <div className="text-[11px] text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-headings:text-[12px] prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-strong:font-semibold prose-strong:text-foreground">
                      <ReactMarkdown>{insightsData.insights}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground py-2">
                      <p>No insights available yet. Add holdings to your portfolio to get AI-powered analysis.</p>
                    </div>
                  )}

                  {insightsData?.timestamp && (
                    <div className="mt-3 pt-3 border-t border-border/50 text-[9px] text-muted-foreground">
                      Last updated: {new Date(insightsData.timestamp).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Factor Analysis Widget */}
                <FactorAnalysisWidget holdings={holdings} />

                {/* Charts Row 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                            labelStyle={{
                              color: "hsl(var(--foreground))",
                            }}
                            itemStyle={{
                              color: "hsl(var(--foreground))",
                            }}
                            formatter={(value: number) => {
                              const total = stats.typeDistribution.reduce((sum, item) => sum + item.value, 0);
                              const percentage = ((value / total) * 100).toFixed(1);
                              return `${formatUsd(value)} (${percentage}%)`;
                            }}
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
              </div>
            )}
          </>
        )}
      </div>

      {/* CSV Import Modal */}
      <CsvImportModal
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        onImport={handleCsvImport}
      />
    </div>
  );
};

export default Portfolio;
