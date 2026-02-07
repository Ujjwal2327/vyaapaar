import {
  Search,
  ChevronsDownUp,
  ArrowUpDown,
  Package,
  Building2,
  Phone,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const PublicPriceListHeader = ({
  businessName,
  userName,
  phone,
  searchTerm,
  setSearchTerm,
  sortType,
  onSortChange,
  onExpandAll,
  onCollapseAll,
  hasAnyExpanded,
}) => {
  const handleToggleExpand = () => {
    if (hasAnyExpanded) {
      onCollapseAll();
    } else {
      onExpandAll();
    }
  };

  return (
    <div className="sticky top-0 z-40 bg-background border-b shadow-sm">
      <div className="max-w-4xl mx-auto p-4">
        {/* Business Info Header */}
        <div className="mb-6 text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Package className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {businessName}
            </h1>
          </div>
          
          {userName && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Building2 className="w-4 h-4" />
              <span className="text-sm">{userName}</span>
            </div>
          )}
          
          {phone && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4" />
              <a 
                href={`tel:${phone}`} 
                className="text-sm hover:text-primary transition-colors"
              >
                {phone}
              </a>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mb-4 justify-between overflow-x-auto">
          <Button
            onClick={handleToggleExpand}
            variant="outline"
            className="shrink-0 flex items-center"
          >
            <ChevronsDownUp className="w-4 h-4" />
            <span className="hidden sm:inline text-xs ml-2">
              {hasAnyExpanded ? "Collapse All" : "Expand All"}
            </span>
          </Button>

          <div className="flex items-center justify-center gap-1">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={sortType} onValueChange={onSortChange}>
              <SelectTrigger className="flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">
                  No Sorting
                </SelectItem>
                <SelectItem value="alphabetical" className="text-xs">
                  A to Z
                </SelectItem>
                <SelectItem value="alphabetical-reverse" className="text-xs">
                  Z to A
                </SelectItem>
                <SelectItem value="price-low" className="text-xs">
                  Price: Low to High
                </SelectItem>
                <SelectItem value="price-high" className="text-xs">
                  Price: High to Low
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search items or categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <Plus className="w-5 h-5 rotate-45" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};