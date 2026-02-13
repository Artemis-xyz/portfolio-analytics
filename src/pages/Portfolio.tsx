import { useState, useCallback, useRef } from "react";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { usePortfolioHoldings, useLinkedAccounts } from "@/hooks/usePortfolio";
import { use24hPrices } from "@/hooks/use24hPrices";
import { Navigate } from "react-router-dom";
import { Loader2, Plus, Trash2, ExternalLink, Upload, Link as LinkIcon, FileSpreadsheet, X, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const formatUsd = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
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
  onImport: (rows: CsvRow[]) => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<CsvRow[] | null>(null);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  if (!open) return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setFileName(file.name);

    if (file.size > 5 * 1024 * 1024) {
      setError("File too large (max 5MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const rows = parseCsv(text);
        if (rows.length === 0) {
          setError("No valid holdings found in CSV");
          return;
        }
        setPreview(rows);
      } catch (err: any) {
        setError(err.message || "Failed to parse CSV");
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const template = `name,ticker,quantity,price,value,cost_basis,type
"Apple Inc",AAPL,10,185.50,1855.00,1500.00,equity
"Bitcoin",BTC,0.5,43000.00,21500.00,20000.00,crypto
"Vanguard S&P 500 ETF",VOO,25,420.00,10500.00,9800.00,etf`;
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
                  Columns: name, ticker, quantity, price, value, cost_basis, type
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFile}
                  className="hidden"
                />
              </div>

              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 mt-3 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-3 h-3" />
                Download template CSV
              </button>

              {error && <p className="text-[11px] text-negative mt-2">{error}</p>}
            </>
          ) : (
            <>
              {/* Preview */}
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

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPreview(null); setFileName(""); }}
                  className="px-2.5 py-1 text-[12px] border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => onImport(preview)}
                  className="px-2.5 py-1 text-[12px] font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
                >
                  Import {preview.length} holdings
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
  const { data: holdings, isLoading: holdingsLoading } = usePortfolioHoldings(user?.id);
  const { data: accounts, isLoading: accountsLoading } = useLinkedAccounts(user?.id);
  const tickers = (holdings ?? []).map((h) => h.ticker).filter(Boolean) as string[];
  const { data: priceData } = use24hPrices(tickers);
  const [linking, setLinking] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  const handleLinkAccount = useCallback(async () => {
    if (!user) return;
    setLinking(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("plaid-create-link-token", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.error) {
        toast.error(res.error.message || "Failed to create link token");
        setLinking(false);
        return;
      }

      const linkToken = res.data?.link_token;
      if (!linkToken) {
        toast.error("No link token received");
        setLinking(false);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
      script.onload = () => {
        const handler = (window as any).Plaid.create({
          token: linkToken,
          onSuccess: async (public_token: string, metadata: any) => {
            try {
              const exchangeRes = await supabase.functions.invoke("plaid-exchange-token", {
                headers: { Authorization: `Bearer ${session?.access_token}` },
                body: { public_token, metadata },
              });

              if (exchangeRes.error) {
                toast.error("Failed to import holdings");
              } else {
                toast.success(`Imported ${exchangeRes.data?.holdings_count || 0} holdings from ${exchangeRes.data?.institution || "account"}`);
                queryClient.invalidateQueries({ queryKey: ["holdings"] });
                queryClient.invalidateQueries({ queryKey: ["linked_accounts"] });
              }
            } catch {
              toast.error("Failed to exchange token");
            }
            setLinking(false);
          },
          onExit: () => setLinking(false),
        });
        handler.open();
      };
      document.head.appendChild(script);
    } catch {
      toast.error("Failed to initialize Plaid");
      setLinking(false);
    }
  }, [user, queryClient]);

  const handleCsvImport = useCallback(async (rows: CsvRow[]) => {
    if (!user) return;
    setImporting(true);
    setCsvOpen(false);

    try {
      const toInsert = rows.map((r) => ({
        user_id: user.id,
        security_name: r.security_name.slice(0, 200),
        ticker: r.ticker?.slice(0, 20) || null,
        quantity: r.quantity,
        close_price: r.close_price,
        value: r.value,
        cost_basis: r.cost_basis,
        asset_type: r.asset_type?.slice(0, 50) || null,
        institution_name: "CSV Import",
      }));

      const { error } = await supabase.from("portfolio_holdings").insert(toInsert);
      if (error) throw error;

      toast.success(`Imported ${rows.length} holdings from CSV`);
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to import CSV");
    }
    setImporting(false);
  }, [user, queryClient]);

  const handleRemoveAccount = async (accountId: string) => {
    const { error } = await supabase
      .from("plaid_items")
      .delete()
      .eq("id", accountId);

    if (error) {
      toast.error("Failed to remove account");
    } else {
      toast.success("Account removed");
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["linked_accounts"] });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const totalValue = holdings?.reduce((s, h) => s + h.value, 0) ?? 0;
  const isLoading = holdingsLoading || accountsLoading;

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
              Total Value: <span className="text-foreground">{formatUsd(totalValue)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCsvOpen(true)}
              disabled={importing}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium border border-border rounded-md text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              Upload CSV
            </button>
            <button
              onClick={handleLinkAccount}
              disabled={linking}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {linking ? <Loader2 className="w-3 h-3 animate-spin" /> : <LinkIcon className="w-3 h-3" />}
              Link via Plaid
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
            {/* Linked Accounts */}
            {accounts && accounts.length > 0 && (
              <div className="mb-5">
                <h2 className="text-[11px] font-medium text-table-header uppercase tracking-wider mb-2">
                  Linked Accounts
                </h2>
                <div className="flex flex-wrap gap-2">
                  {accounts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 border border-border rounded-md text-[12px]"
                    >
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      <span className="text-foreground">{a.institution_name || "Account"}</span>
                      <button
                        onClick={() => handleRemoveAccount(a.id)}
                        className="text-muted-foreground hover:text-negative transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Holdings Table */}
            {holdings && holdings.length > 0 ? (
              <div>
                <h2 className="text-[11px] font-medium text-table-header uppercase tracking-wider mb-2">
                  Holdings
                </h2>
                <div className="border border-border rounded-md overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">Name</th>
                        <th className="text-left text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">Ticker</th>
                        <th className="text-right text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">Qty</th>
                        <th className="text-right text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">Price</th>
                        <th className="text-right text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">Value</th>
                        <th className="text-right text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">24H PNL</th>
                        <th className="text-left text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">Type</th>
                        <th className="text-left text-[10px] font-medium text-table-header uppercase tracking-wider px-3 py-2">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((h) => {
                        const tickerUpper = h.ticker?.toUpperCase() || "";
                        const pd = tickerUpper && priceData ? priceData[tickerUpper] : null;
                        // 24h PNL: asset's % change * quantity * current price gives $ PNL for the position
                        const pnlPct = pd ? pd.changePct : null;
                        const pnlDollar = pd ? pd.change * h.quantity : null;
                        const livePrice = pd ? pd.price : null;
                        return (
                          <tr key={h.id} className="border-b border-border/50 hover:bg-table-row-hover transition-colors">
                            <td className="text-[12px] text-foreground px-3 py-1.5 max-w-[180px] truncate">
                              {h.security_name}
                            </td>
                            <td className="text-[12px] text-foreground font-medium px-3 py-1.5">
                              {h.ticker || "—"}
                            </td>
                            <td className="text-[12px] text-foreground text-right px-3 py-1.5 tabular-nums">
                              {h.quantity.toFixed(4)}
                            </td>
                            <td className="text-[12px] text-foreground text-right px-3 py-1.5 tabular-nums">
                              {livePrice != null ? formatUsd(livePrice) : formatUsd(h.close_price)}
                            </td>
                            <td className="text-[12px] text-foreground text-right px-3 py-1.5 font-medium tabular-nums">
                              {livePrice != null ? formatUsd(livePrice * h.quantity) : formatUsd(h.value)}
                            </td>
                            <td className="text-right px-3 py-1.5 tabular-nums">
                              {pnlDollar != null && pnlPct != null ? (
                                <span className={`text-[12px] ${pnlDollar >= 0 ? "text-positive" : "text-negative"}`}>
                                  {pnlDollar >= 0 ? "+" : ""}{formatUsd(pnlDollar)}{" "}
                                  <span className="text-[10px]">
                                    ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
                                  </span>
                                </span>
                              ) : (
                                <span className="text-[12px] text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="text-[11px] text-muted-foreground px-3 py-1.5">{h.asset_type || "—"}</td>
                            <td className="text-[11px] text-muted-foreground px-3 py-1.5">{h.institution_name || "—"}</td>
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
                  No holdings yet. Import your portfolio to get started.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCsvOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium border border-border rounded-md text-foreground hover:bg-secondary transition-colors"
                  >
                    <Upload className="w-3 h-3" />
                    Upload CSV
                  </button>
                  <button
                    onClick={handleLinkAccount}
                    disabled={linking}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {linking ? <Loader2 className="w-3 h-3 animate-spin" /> : <LinkIcon className="w-3 h-3" />}
                    Link via Plaid
                  </button>
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
