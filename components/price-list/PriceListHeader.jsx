import {
  Search,
  FileText,
  Plus,
  ChevronsDownUp,
  ArrowUpDown,
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
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Price List</h1>
          <div className="flex gap-2">
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

        <Button
          onClick={cyclePriceView}
          className="w-full mb-4"
          variant={
            priceView === "sell"
              ? "default"
              : priceView === "cost"
              ? "secondary"
              : "outline"
          }
        >
          {getPriceViewText()}
        </Button>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 text-muted-foreground w-5 h-5" />
          <Input
            type="text"
            placeholder="Search items, brands, or categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-4 mb-4">
          <Button
            onClick={handleToggleExpand}
            variant="outline"
            size="sm"
            className="flex-shrink-0"
          >
            <ChevronsDownUp className="w-4 h-4 mr-2" />
            {hasAnyExpanded ? "Collapse All" : "Expand All"}
          </Button>

          <div className="flex items-center justify-center gap-1">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={sortType} onValueChange={onSortChange}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Sorting</SelectItem>
                <SelectItem value="alphabetical">A to Z</SelectItem>
                <SelectItem value="alphabetical-reverse">Z to A</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
