import { ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface VaultRow {
  name: string;
  vaultAddress: string;
  leader: string;
  apr: number;
  tvl: string;
  ageDays: number;
}

interface VaultTableProps {
  title: string;
  vaults: VaultRow[];
  loading?: boolean;
}

const VaultTable = ({ title, vaults, loading }: VaultTableProps) => {
  const navigate = useNavigate();

  const formatAPY = (apy: number) => {
    const formatted = (apy * 100).toFixed(2) + "%";
    return formatted;
  };

  const formatTvl = (tvl: string) => {
    const num = parseFloat(tvl);
    if (isNaN(num)) return tvl;
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const truncateAddress = (addr: string) =>
    addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  const handleRowClick = (vaultAddress: string) => {
    navigate(`/vault/${vaultAddress}`);
  };

  return (
    <div className="mb-5">
      <h2 className="text-[11px] font-medium text-muted-foreground tracking-wide mb-2">
        {title}
      </h2>

      <div className="w-full">
        {/* Table Header */}
        <div className="grid grid-cols-5 gap-3 text-[11px] text-muted-foreground py-1.5 border-b border-border/50">
          <div className="col-span-1">Vault</div>
          <div className="col-span-1">Leader</div>
          <div className="col-span-1">APR</div>
          <div className="col-span-1 flex items-center gap-0.5">
            TVL <ChevronDown className="w-3 h-3" />
          </div>
          <div className="col-span-1">Age (days)</div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-4 text-center text-[13px] text-muted-foreground">
            Loading vaults...
          </div>
        )}

        {/* Table Body */}
        {!loading &&
          vaults.map((vault, index) => (
            <div
              key={index}
              onClick={() => handleRowClick(vault.vaultAddress)}
              className="grid grid-cols-5 gap-3 text-[13px] py-2 border-b border-border/30 hover:bg-table-row-hover transition-colors cursor-pointer"
            >
              <div className="col-span-1 text-foreground truncate">{vault.name}</div>
              <div className="col-span-1 text-muted-foreground font-mono text-[11px]">
                {truncateAddress(vault.leader)}
              </div>
              <div className={`col-span-1 ${vault.apr >= 0 ? "text-positive" : "text-negative"}`}>
                {formatAPY(vault.apr)}
              </div>
              <div className="col-span-1 text-foreground">{formatTvl(vault.tvl)}</div>
              <div className="col-span-1 text-foreground">{vault.ageDays}</div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default VaultTable;
