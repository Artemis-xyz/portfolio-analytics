import { useState } from "react";
import AssetSelector from "./AssetSelector";

interface TradingHeaderProps {
  selectedAsset: string;
  onAssetChange: (asset: string) => void;
}

const marketTabs = ["Options", "Perpetuals", "Spot", "Vaults"];

const TradingHeader = ({ selectedAsset, onAssetChange }: TradingHeaderProps) => {
  const [activeMarket, setActiveMarket] = useState("Spot");

  return (
    <div className="border-b border-border">
      {/* Market Tabs Row */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border">
        {marketTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveMarket(tab)}
            className={`px-3 py-1 text-[12px] rounded ${
              activeMarket === tab
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Asset Info Row */}
      <div className="flex items-center gap-4 px-2 py-1.5">
        <AssetSelector value={selectedAsset} onChange={onAssetChange} />

        <div className="flex items-center gap-6 text-[11px]">
          <div>
            <span className="text-muted-foreground">Mark Price</span>
            <p className="text-foreground font-medium">2,937.75</p>
          </div>
          <div>
            <span className="text-muted-foreground">Index Price</span>
            <p className="text-foreground font-medium">2,937.75</p>
          </div>
          <div>
            <span className="text-muted-foreground">24h Change</span>
            <p className="text-positive font-medium">+0.00%</p>
          </div>
          <div>
            <span className="text-muted-foreground">24h Volume</span>
            <p className="text-foreground font-medium">-</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingHeader;
