const AssetMetrics = () => {
  const metrics = [
    { label: "SMB Factor", value: "0.0", isPositive: false },
    { label: "Momentum Factor", value: "0.0", isPositive: false },
    { label: "Value Factor", value: "0.0", isPositive: false },
    { label: "Market Risk Factor", value: "0.0", isPositive: false },
  ];

  return (
    <div className="border-t border-border">
      {metrics.map((metric, index) => (
        <div
          key={metric.label}
          className="flex justify-between items-center px-4 py-1.5 border-b border-border/50"
        >
          <span className="text-[11px] text-muted-foreground">{metric.label}</span>
          <span
            className={`text-[11px] font-medium ${
              metric.isPositive ? "text-positive" : "text-foreground"
            }`}
          >
            {metric.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default AssetMetrics;
