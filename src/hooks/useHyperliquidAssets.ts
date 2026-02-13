import { useState, useEffect } from "react";

interface AssetInfo {
  name: string;
  szDecimals: number;
  maxLeverage?: number;
  isDelisted?: boolean;
}

interface PerpDex {
  name: string;
  fullName: string;
}

interface Asset {
  value: string;
  label: string;
  name: string;
  type: "perp" | "hyperp";
  dex: string;
}

export const useHyperliquidAssets = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        // Step 1: Get list of all perp dexes
        const dexResponse = await fetch("https://api.hyperliquid.xyz/info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "perpDexs" }),
        });
        const dexes: (PerpDex | null)[] = await dexResponse.json();

        // Step 2: Fetch meta for main perps (empty dex) and each HIP-3 dex
        const dexNames = ["", ...dexes.filter((d): d is PerpDex => d !== null).map(d => d.name)];
        
        const metaPromises = dexNames.map(dex =>
          fetch("https://api.hyperliquid.xyz/info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "meta", dex }),
          }).then(res => res.json())
        );

        const metaResults = await Promise.all(metaPromises);
        const allAssets: Asset[] = [];

        metaResults.forEach((meta, index) => {
          const dexName = dexNames[index];
          const isMainPerps = dexName === "";
          
          if (meta?.universe) {
            meta.universe.forEach((asset: AssetInfo) => {
              // Skip delisted assets
              if (asset.isDelisted) return;
              
              // For HIP-3, names might be like "xyz:TICKER"
              const displayName = asset.name.includes(":") 
                ? asset.name.split(":")[1] 
                : asset.name;
              
              allAssets.push({
                value: asset.name,
                label: displayName,
                name: asset.name,
                type: isMainPerps ? "perp" : "hyperp",
                dex: dexName,
              });
            });
          }
        });

        // Sort: main perps first alphabetically, then hyperp alphabetically
        allAssets.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === "perp" ? -1 : 1;
          }
          return a.label.localeCompare(b.label);
        });

        setAssets(allAssets);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch Hyperliquid assets:", err);
        setError("Failed to load assets");
        setLoading(false);
      }
    };

    fetchAssets();
  }, []);

  return { assets, loading, error };
};
