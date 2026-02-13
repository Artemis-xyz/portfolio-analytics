import { useState } from "react";
import { useHyperliquidWS } from "@/hooks/useHyperliquidWS";

interface OrderBookProps {
  coin?: string;
}

const OrderBook = ({ coin = "ETH" }: OrderBookProps) => {
  const [activeTab, setActiveTab] = useState<"orderbook" | "trades">("orderbook");
  const { asks, bids, trades, connected, spread } = useHyperliquidWS(coin);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full border-l border-border">
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("orderbook")}
          className={`flex-1 px-3 py-2 text-[11px] ${
            activeTab === "orderbook"
              ? "text-foreground border-b-2 border-foreground"
              : "text-muted-foreground"
          }`}
        >
          Order Book
        </button>
        <button
          onClick={() => setActiveTab("trades")}
          className={`flex-1 px-3 py-2 text-[11px] ${
            activeTab === "trades"
              ? "text-foreground border-b-2 border-foreground"
              : "text-muted-foreground"
          }`}
        >
          Trades
        </button>
      </div>

      {activeTab === "orderbook" && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-2 px-2 py-1 border-b border-border">
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-positive" : "bg-negative"}`} />
            <span className="text-[10px] text-muted-foreground">
              {connected ? "Live" : "Connecting..."}
            </span>
          </div>

          {/* Column Headers */}
          <div className="grid grid-cols-3 gap-1 px-2 py-1 text-[10px] text-muted-foreground border-b border-border">
            <div>Price</div>
            <div className="text-right">Size ({coin})</div>
            <div className="text-right">Total ({coin})</div>
          </div>

          {/* Order Book Data */}
          <div className="flex-1 overflow-y-auto">
            {/* Asks (Sells) - Red */}
            {asks.length > 0 ? (
              asks.map((order, i) => (
                <div
                  key={`ask-${i}`}
                  className="grid grid-cols-3 gap-1 px-2 py-0.5 text-[11px] hover:bg-secondary/50"
                >
                  <div className="text-negative">{order.price}</div>
                  <div className="text-right text-foreground">{order.size}</div>
                  <div className="text-right text-muted-foreground">{order.total}</div>
                </div>
              ))
            ) : (
              <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">
                Loading asks...
              </div>
            )}

            {/* Spread */}
            <div className="grid grid-cols-3 gap-1 px-2 py-1 text-[10px] bg-secondary/30 border-y border-border">
              <div className="text-muted-foreground">Spread</div>
              <div className="text-right text-foreground">{spread.value}</div>
              <div className="text-right text-muted-foreground">{spread.percent}</div>
            </div>

            {/* Bids (Buys) - Green */}
            {bids.length > 0 ? (
              bids.map((order, i) => (
                <div
                  key={`bid-${i}`}
                  className="grid grid-cols-3 gap-1 px-2 py-0.5 text-[11px] hover:bg-secondary/50"
                >
                  <div className="text-positive">{order.price}</div>
                  <div className="text-right text-foreground">{order.size}</div>
                  <div className="text-right text-muted-foreground">{order.total}</div>
                </div>
              ))
            ) : (
              <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">
                Loading bids...
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "trades" && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Column Headers */}
          <div className="grid grid-cols-4 gap-1 px-2 py-1 text-[10px] text-muted-foreground border-b border-border">
            <div className="text-left">Price</div>
            <div className="text-right">Size</div>
            <div className="text-right">Side</div>
            <div className="text-right">Time</div>
          </div>

          {/* Trades Data */}
          <div className="flex-1 overflow-y-auto">
            {trades.length > 0 ? (
              trades.map((trade, i) => (
                <div
                  key={`trade-${trade.tid || i}-${i}`}
                  className="grid grid-cols-4 gap-1 px-2 py-0.5 text-[11px] hover:bg-secondary/50"
                >
                  <div className={`text-left ${trade.side === "B" ? "text-positive" : "text-negative"}`}>
                    {parseFloat(trade.px).toFixed(2)}
                  </div>
                  <div className="text-right text-foreground">
                    {parseFloat(trade.sz).toFixed(4)}
                  </div>
                  <div
                    className={`text-right ${trade.side === "B" ? "text-positive" : "text-negative"}`}
                  >
                    {trade.side === "B" ? "Buy" : "Sell"}
                  </div>
                  <div className="text-right text-muted-foreground">
                    {formatTime(trade.time)}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">
                {connected ? "Waiting for trades..." : "Connecting..."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderBook;
