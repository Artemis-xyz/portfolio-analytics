import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  rowsPerPage: number;
  currentStart: number;
  currentEnd: number;
  total: number;
}

const Pagination = ({ rowsPerPage, currentStart, currentEnd, total }: PaginationProps) => {
  return (
    <div className="flex items-center justify-end gap-5 py-3 text-[13px] text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Rows per page:</span>
        <button className="flex items-center gap-1 px-2 py-1 border border-border rounded hover:bg-secondary transition-colors">
          {rowsPerPage}
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
      
      <span>
        {currentStart}-{currentEnd} of {total.toLocaleString()}
      </span>
      
      <div className="flex items-center gap-1">
        <button className="p-1 hover:bg-secondary rounded transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button className="p-1 hover:bg-secondary rounded transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
