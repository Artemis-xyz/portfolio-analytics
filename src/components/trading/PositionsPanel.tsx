import { useState } from "react";

const tabs = [
  { label: "Positions", count: 0 },
  { label: "Open Orders", count: 0 },
  { label: "Trade History", count: null },
];

const PositionsPanel = () => {
  const [activeTab, setActiveTab] = useState("Positions");

  return (
    <div className="border-t border-border">
      {/* Tabs */}
      <div className="flex items-center px-2 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(tab.label)}
            className={`px-3 py-2 text-[11px] transition-colors ${
              activeTab === tab.label
                ? "text-foreground border-b-2 border-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== null && ` (${tab.count})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="h-24 flex items-center justify-center">
        <p className="text-[12px] text-muted-foreground">
          Connect wallet to view positions
        </p>
      </div>
    </div>
  );
};

export default PositionsPanel;
