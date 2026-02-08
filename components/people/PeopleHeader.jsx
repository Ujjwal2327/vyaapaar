import {
  Search,
  Plus,
  ArrowUpDown,
  Users,
  Filter,
  FileText,
  FileDown,
  Download,
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
import { Badge } from "@/components/ui/badge";
import Logo from "@/components/Logo";
import Navigation from "@/components/Navigation";
import SettingsModal from "@/components/SettingsModal";
import { sortCategories, getCategoryCounts } from "@/lib/utils/categoryUtils";

export const PeopleHeader = ({
  searchTerm,
  setSearchTerm,
  categoryFilter,
  setCategoryFilter,
  editMode,
  setEditMode,
  onAddPerson,
  onBulkEdit,
  onExportPDF,
  sortType,
  onSortChange,
  totalCount,
  filteredCount,
  peopleData,
  onCategoriesUpdate,
  availableCategories,
}) => {
  // Sort categories alphabetically with "Other" at the end
  const sortedCategories = sortCategories(availableCategories);

  // Get counts for each category
  const categoryCounts = getCategoryCounts(peopleData, availableCategories);

  // Build categories list with counts for dropdown
  const CATEGORIES = [
    { value: "all", label: "All Contacts", count: totalCount },
    ...sortedCategories.map((cat) => ({
      value: cat.id,
      label: cat.label,
      count: categoryCounts[cat.id] || 0,
    })),
  ];

  // Get current category label
  const getCurrentCategoryLabel = () => {
    if (!categoryFilter) return `All Contacts`;

    const category = CATEGORIES.find((cat) => cat.value === categoryFilter);
    return category ? category.label : "Select Category";
  };

  // Get current category count
  const getCurrentCategoryCount = () => {
    if (!categoryFilter) return totalCount;

    const category = CATEGORIES.find((cat) => cat.value === categoryFilter);
    return category ? category.count : "";
  };

  return (
    <div className="sticky top-0 z-40 bg-background border-b">
      <div className="max-w-4xl mx-auto p-2">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <Logo titleClassName="hidden sm:inline" />
            <Navigation />
          </div>
          <div className="flex justify-center items-center gap-2">
            <SettingsModal
              peopleData={peopleData}
              onCategoriesUpdate={onCategoriesUpdate}
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
          <Button onClick={onExportPDF} variant="outline" size="sm">
            <Download className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Export PDF</span>
          </Button>

<div className="flex justify-center gap-x-4">
          <div className="flex items-center gap-2 ">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select
              value={categoryFilter || "all"}
              onValueChange={(value) => {
                setCategoryFilter(value === "all" ? "" : value);
                if (value !== "all" && sortType === "category")
                  onSortChange("name-asc");
              }}
            >
              <SelectTrigger className="flex-1 text-xs">
                <SelectValue>
                  <>
                    <div className="flex items-center justify-between w-full gap-3">
                      <span>{getCurrentCategoryLabel()}</span>
                      <Badge variant="secondary" className="text-xs">
                        {getCurrentCategoryCount()}
                      </Badge>
                    </div>
                  </>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem
                    key={cat.value}
                    value={cat.value}
                    className="text-xs"
                  >
                    <div className="flex items-center justify-between w-full gap-3">
                      <span>{cat.label}</span>
                      <Badge variant="secondary" className="text-xs">
                        {cat.count}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={sortType} onValueChange={onSortChange}>
              <SelectTrigger className="flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc" className="text-xs">
                  A to Z
                </SelectItem>
                <SelectItem value="name-desc" className="text-xs">
                  Z to A
                </SelectItem>
                {categoryFilter === "" ? (
                  <SelectItem value="category" className="text-xs">
                    By Category
                  </SelectItem>
                ) : (
                  ""
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by name, phone, specialty, or address..."
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
          <Button onClick={onAddPerson} className="w-full" variant="outline">
            <Plus className="w-5 h-5 mr-2" />
            Add Contact
          </Button>
        )}
      </div>
    </div>
  );
};
