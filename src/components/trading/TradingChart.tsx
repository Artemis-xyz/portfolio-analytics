import { useEffect, useRef, memo } from "react";
import { useTheme } from "next-themes";

interface TradingChartProps {
  symbol?: string;
  interval?: string;
}

const TradingChart = ({ symbol = "COINBASE:ETHUSD", interval = "5" }: TradingChartProps) => {
  const container = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!container.current) return;

    // Clear any existing content
    container.current.innerHTML = '';

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: interval,
      timezone: "Etc/UTC",
      theme: theme === "dark" ? "dark" : "light",
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      calendar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com"
    });

    container.current.appendChild(script);

    return () => {
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, [symbol, interval, theme]);

  return (
    <div className="h-full w-full" ref={container}>
      <div className="tradingview-widget-container" style={{ height: "100%", width: "100%" }}>
        <div className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }}></div>
      </div>
    </div>
  );
};

export default memo(TradingChart);
