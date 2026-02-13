import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const timeOptions = [
  { value: "1D", label: "1D" },
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "6M", label: "6M" },
  { value: "all-time", label: "All-time" },
];

interface TimeFilterProps {
  value?: string;
  onChange?: (value: string) => void;
}

const TimeFilter = ({ value, onChange }: TimeFilterProps) => {
  const [internal, setInternal] = useState("all-time");
  const selected = value ?? internal;
  const handleChange = onChange ?? setInternal;

  return (
    <Select value={selected} onValueChange={handleChange}>
      <SelectTrigger className="h-auto px-2.5 py-1.5 text-[13px] w-auto min-w-[80px] bg-transparent border-border">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {timeOptions.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-[13px]">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default TimeFilter;
