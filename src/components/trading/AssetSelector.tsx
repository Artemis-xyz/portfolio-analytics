import { ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AssetSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const assets = [
  { value: "ETH", label: "ETH", name: "Ethereum" },
  { value: "BTC", label: "BTC", name: "Bitcoin" },
  { value: "SOL", label: "SOL", name: "Solana" },
  { value: "AVAX", label: "AVAX", name: "Avalanche" },
  { value: "ARB", label: "ARB", name: "Arbitrum" },
];

const AssetSelector = ({ value, onChange }: AssetSelectorProps) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-auto px-2 py-1 text-[13px] w-auto min-w-[70px] bg-secondary border-none gap-1">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {assets.map((asset) => (
          <SelectItem key={asset.value} value={asset.value} className="text-[12px]">
            <div className="flex items-center gap-2">
              <span className="font-medium">{asset.label}</span>
              <span className="text-muted-foreground">{asset.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default AssetSelector;
