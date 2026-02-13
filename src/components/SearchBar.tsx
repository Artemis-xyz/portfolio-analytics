import { Search } from "lucide-react";

const SearchBar = () => {
  return (
    <div className="relative w-60">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
      <input
        type="text"
        placeholder="Search by vault address, name or creator..."
        className="w-full pl-8 pr-3 py-1.5 text-[13px] bg-input border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
};

export default SearchBar;
