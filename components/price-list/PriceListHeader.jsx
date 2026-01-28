import {
  Search,
  FileText,
  Plus,
  ChevronsDownUp,
  ArrowUpDown,
  Package,
  Boxes,
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
import SettingsModal from "@/components/SettingsModal";
import Logo from "@/components/Logo"

export const PriceListHeader = ({
  searchTerm,
  setSearchTerm,
  editMode,
  setEditMode,
  priceView,
  cyclePriceView,
  getPriceViewText,
  onBulkEdit,
  onAddCategory,
  onExpandAll,
  onCollapseAll,
  sortType,
  onSortChange,
  hasAnyExpanded,
  sellPriceMode,
  toggleSellPriceMode,
}) => {
  const handleToggleExpand = () => {
    if (hasAnyExpanded) {
      onCollapseAll();
    } else {
      onExpandAll();
    }
  };

  return (
    <div className="sticky top-0 z-40 bg-background border-b">
      <div className="max-w-4xl mx-auto p-2">
        <div className="flex justify-between items-center mb-4">
          <Logo/>
          <div className="flex justify-center items-center gap-2">
            <SettingsModal
              sellPriceMode={sellPriceMode}
              toggleSellPriceMode={toggleSellPriceMode}
            />
            <Button onClick={onBulkEdit} variant="outline" size="sm">
              <FileText className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Bulk Edit</span>
            </Button>
            <Button
              onClick={() => setEditMode(!editMode)}
              variant={editMode ? "destructive" : "default"}
              size="sm"
            >
              {editMode ? "Done" : "Edit"}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4 justify-between overflow-x-auto">
          <Button
            onClick={handleToggleExpand}
            variant="outline"
            className="shrink-0 flex items-center"
          >
            <ChevronsDownUp className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">
              {hasAnyExpanded ? "Collapse All" : "Expand All"}
            </span>
          </Button>
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              className="font-extrabold text-xl"
              onClick={toggleSellPriceMode}
              title={`Switch to ${sellPriceMode === "retail" ? "Bulk" : "Retail"} prices`}
            >
              {sellPriceMode == "retail" ? "R" : "B"}
            </Button>
            <Button
              onClick={cyclePriceView}
              variant={
                priceView === "sell"
                  ? "default"
                  : priceView === "cost"
                    ? "secondary"
                    : "outline"
              }
              className="w-fit"
            >
              {getPriceViewText()}
            </Button>

            <div className="flex items-center justify-center gap-1 float-right">
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
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search items, brands, or categories..."
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

        {editMode && (
          <Button onClick={onAddCategory} className="w-full" variant="outline">
            <Plus className="w-5 h-5 mr-2" />
            Add Category
          </Button>
        )}
      </div>
    </div>
  );
};
