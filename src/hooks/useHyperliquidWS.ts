import { useState, useEffect, useCallback, useRef } from "react";

interface OrderBookLevel {
  price: string;
  size: string;
  total: string;
}

interface Trade {
  coin: string;
  side: "B" | "A";
  px: string;
  sz: string;
  time: number;
  hash: string;
  tid: number;
}

interface UseHyperliquidWSReturn {
  asks: OrderBookLevel[];
  bids: OrderBookLevel[];
  trades: Trade[];
  connected: boolean;
  spread: { value: string; percent: string };
}

export const useHyperliquidWS = (coin: string = "ETH"): UseHyperliquidWSReturn => {
  const [asks, setAsks] = useState<OrderBookLevel[]>([]);
  const [bids, setBids] = useState<OrderBookLevel[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [connected, setConnected] = useState(false);
  const [spread, setSpread] = useState({ value: "0", percent: "0" });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const processOrderBook = useCallback((data: { levels: [any[], any[]] }) => {
    if (!data.levels) return;

    const [rawBids, rawAsks] = data.levels;

    // Process asks (sells) - sorted ascending
    let askTotal = 0;
    const processedAsks: OrderBookLevel[] = rawAsks
      .slice(0, 20)
      .map((level: { px: string; sz: string }) => {
        askTotal += parseFloat(level.sz);
        return {
          price: parseFloat(level.px).toFixed(2),
          size: parseFloat(level.sz).toFixed(2),
          total: askTotal.toFixed(0),
        };
      })
      .reverse();

    // Process bids (buys) - sorted descending
    let bidTotal = 0;
    const processedBids: OrderBookLevel[] = rawBids
      .slice(0, 20)
      .map((level: { px: string; sz: string }) => {
        bidTotal += parseFloat(level.sz);
        return {
          price: parseFloat(level.px).toFixed(2),
          size: parseFloat(level.sz).toFixed(2),
          total: bidTotal.toFixed(0),
        };
      });

    setAsks(processedAsks);
    setBids(processedBids);

    // Calculate spread from best bid and best ask
    if (rawAsks.length > 0 && rawBids.length > 0) {
      const bestAsk = parseFloat(rawAsks[0].px);
      const bestBid = parseFloat(rawBids[0].px);
      const spreadValue = Math.abs(bestAsk - bestBid);
      const midPrice = (bestAsk + bestBid) / 2;
      const spreadPercent = (spreadValue / midPrice) * 100;
      
      setSpread({
        value: spreadValue.toFixed(2),
        percent: spreadPercent.toFixed(4) + "%",
      });
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket("wss://api.hyperliquid.xyz/ws");
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      
      // Subscribe to L2 order book
      ws.send(
        JSON.stringify({
          method: "subscribe",
          subscription: { type: "l2Book", coin },
        })
      );

      // Subscribe to trades
      ws.send(
        JSON.stringify({
          method: "subscribe",
          subscription: { type: "trades", coin },
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.channel === "l2Book") {
          processOrderBook(message.data);
        } else if (message.channel === "trades") {
          const newTrades = message.data as Trade[];
          setTrades((prev) => [...newTrades, ...prev].slice(0, 50));
        }
      } catch (error) {
        console.error("WebSocket message parse error:", error);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      ws.close();
    };
  }, [coin, processOrderBook]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { asks, bids, trades, connected, spread };
};
