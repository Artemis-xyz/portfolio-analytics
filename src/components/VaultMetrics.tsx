interface VaultMetricsProps {
  pnl: string;
  maxDrawdown: string;
  volume: string;
  sharpe: string;
  sortino: string;
}

const VaultMetrics = ({ pnl, maxDrawdown, volume, sharpe, sortino }: VaultMetricsProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 py-4 border-t border-border">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-muted-foreground uppercase">PNL</span>
        <span className={`text-[15px] font-medium ${pnl.startsWith('-') ? 'text-negative' : 'text-positive'}`}>
          {pnl}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-muted-foreground uppercase">Max Drawdown</span>
        <span className="text-[15px] font-medium text-foreground">{maxDrawdown}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-muted-foreground uppercase">Volume</span>
        <span className="text-[15px] font-medium text-foreground">{volume}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-muted-foreground uppercase">Sharpe</span>
        <span className="text-[15px] font-medium text-foreground">{sharpe}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-muted-foreground uppercase">Sortino</span>
        <span className="text-[15px] font-medium text-foreground">{sortino}</span>
      </div>
    </div>
  );
};

export default VaultMetrics;
