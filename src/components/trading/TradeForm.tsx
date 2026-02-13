import { useState } from "react";
import { Switch } from "@/components/ui/switch";

const TradeForm = () => {
  const [orderType, setOrderType] = useState<"market" | "limit" | "advanced">("market");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpsl, setTpsl] = useState(false);

  return (
    <div className="flex flex-col h-full border-l border-border">
      {/* Order Type Tabs */}
      <div className="flex border-b border-border">
        {(["market", "limit", "advanced"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setOrderType(type)}
            className={`flex-1 px-2 py-2 text-[11px] capitalize ${
              orderType === type
                ? "text-foreground border-b-2 border-foreground"
                : "text-muted-foreground"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Buy/Sell Toggle */}
      <div className="flex p-2 gap-1">
        <button
          onClick={() => setSide("buy")}
          className={`flex-1 py-2 text-[11px] rounded ${
            side === "buy"
              ? "bg-positive text-background"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          Buy / Long
        </button>
        <button
          onClick={() => setSide("sell")}
          className={`flex-1 py-2 text-[11px] rounded ${
            side === "sell"
              ? "bg-negative text-background"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          Sell / Short
        </button>
      </div>

      {/* Form Fields */}
      <div className="flex-1 p-2 space-y-3 overflow-y-auto">
        {/* Available to Trade */}
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Available to Trade</span>
          <span className="text-foreground">-</span>
        </div>

        {/* Position */}
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Position</span>
          <span className="text-foreground">-</span>
        </div>

        {/* Amount */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Amount</label>
          <div className="flex border border-border rounded">
            <input
              type="text"
              defaultValue="0.0000"
              className="flex-1 bg-transparent px-2 py-1.5 text-[11px] text-foreground outline-none"
            />
            <span className="flex items-center px-2 text-[11px] text-muted-foreground border-l border-border">
              ETH
            </span>
          </div>
        </div>

        {/* Price (for limit orders) */}
        {orderType === "limit" && (
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Price</label>
            <div className="flex border border-border rounded">
              <input
                type="text"
                defaultValue="0.00"
                className="flex-1 bg-transparent px-2 py-1.5 text-[11px] text-foreground outline-none"
              />
              <span className="flex items-center px-2 text-[11px] text-muted-foreground border-l border-border">
                USDC
              </span>
            </div>
          </div>
        )}

        {/* Reduce Only */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Reduce Only</span>
          <Switch
            checked={reduceOnly}
            onCheckedChange={setReduceOnly}
            className="scale-75"
          />
        </div>

        {/* Take Profit / Stop Loss */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Take Profit / Stop Loss</span>
          <Switch
            checked={tpsl}
            onCheckedChange={setTpsl}
            className="scale-75"
          />
        </div>

        {/* Order Details */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Order Size</span>
            <span className="text-foreground">-</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Order Value</span>
            <span className="text-foreground">-</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Est. Liq. Price</span>
            <span className="text-foreground">-</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Position Margin</span>
            <span className="text-foreground">$0.00</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Est. Price</span>
            <span className="text-foreground">-</span>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="p-2 border-t border-border">
        <button
          className={`w-full py-2.5 text-[11px] rounded ${
            side === "buy"
              ? "bg-positive text-background"
              : "bg-negative text-background"
          }`}
        >
          {side === "buy" ? "Buy / Long" : "Sell / Short"}
        </button>
      </div>

      {/* Account Info */}
      <div className="p-2 border-t border-border space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Accounts</span>
          <span className="text-foreground">≡</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Perpetuals Equity</span>
          <span className="text-foreground">-</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Perpetuals Overview</span>
          <span className="text-foreground">-</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Unrealized PnL</span>
          <span className="text-foreground">-</span>
        </div>
      </div>
    </div>
  );
};

export default TradeForm;
