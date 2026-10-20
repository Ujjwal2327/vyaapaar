import { useEffect } from "react";
import {
  Search,
  Plus,
  ArrowUpDown,
  Filter,
  FileText,
  Download,
  Upload,
  UserSearch,
  Scale,
  MoreHorizontal,
  BellRing,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import SettingsButton from "@/components/SettingsButton";
import PageHeader from "@/components/PageHeader";
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
  onImportVCF,
  onFindDuplicates,
  onOpenReminders,
  remindersOffline,
  sortType,
  onSortChange,
  totalCount,
  filteredCount,
  peopleData,
  availableCategories,
  categoriesWithContacts,
  onlyWithBalance,
  setOnlyWithBalance,
}) => {
  // Sort categories with contacts alphabetically with "Other" at the end
  const sortedCategoriesWithContacts = sortCategories(categoriesWithContacts);

  // Get counts for each category
  const categoryCounts = getCategoryCounts(peopleData, categoriesWithContacts);

  // Only show "All Contacts" if there's more than one category with contacts
  const showAllOption = sortedCategoriesWithContacts.length > 1;

  // Automatically change sort type if categories reduce to 1 while sorted by category
  useEffect(() => {
    if (sortedCategoriesWithContacts.length === 1 && sortType === "category") {
      onSortChange("name-asc");
    }
  }, [sortedCategoriesWithContacts.length, sortType, onSortChange]);

  // Build categories list with counts for dropdown
  const CATEGORIES = [
    ...(showAllOption
      ? [{ value: "all", label: "All Contacts", count: totalCount }]
      : []),
    ...sortedCategoriesWithContacts.map((cat) => ({
      value: cat.id,
      label: cat.label,
      count: categoryCounts[cat.id] || 0,
    })),
  ];

  // Get current category label
  const getCurrentCategoryLabel = () => {
    // If only 1 category with contacts, show that category's name
    if (!showAllOption && sortedCategoriesWithContacts.length === 1) {
      return sortedCategoriesWithContacts[0].label;
    }

    if (!categoryFilter && showAllOption) return `All Contacts`;

    const category = CATEGORIES.find((cat) => cat.value === categoryFilter);
    return category ? category.label : "Select Category";
  };

  // Get current category count
  const getCurrentCategoryCount = () => {
    // If only 1 category with contacts, show that category's count
    if (!showAllOption && sortedCategoriesWithContacts.length === 1) {
      return categoryCounts[sortedCategoriesWithContacts[0].id] || 0;
    }

    if (!categoryFilter && showAllOption) return totalCount;

    const category = CATEGORIES.find((cat) => cat.value === categoryFilter);
    return category ? category.count : "";
  };

  return (
    <PageHeader
      actions={
        <>
          <SettingsButton />

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
        </>
      }
    >
      <div className="flex items-center gap-4 mb-4 justify-between overflow-x-auto">
        <div className="flex gap-2">
          {/* Export PDF / Find Duplicates / Import Contacts collapsed into
              one menu — three buttons side by side didn't fit next to the
              balance/category/sort controls on the right. Each option
              still does exactly what its old standalone button did. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <MoreHorizontal className="w-4 h-4" />
                <span className="hidden md:inline">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={onOpenReminders}
                disabled={remindersOffline}
              >
                <BellRing className="w-4 h-4 mr-2" />
                Payment reminders
                {remindersOffline && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    Needs internet
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onExportPDF}>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onFindDuplicates}>
                <UserSearch className="w-4 h-4 mr-2" />
                Find Duplicates
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onImportVCF}>
                <Upload className="w-4 h-4 mr-2" />
                Import Contacts
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex justify-center gap-x-4">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setOnlyWithBalance(!onlyWithBalance)}
              variant={onlyWithBalance ? "default" : "outline"}
              size="sm"
              className="gap-1.5 shrink-0"
              title="Only show contacts with a non-zero balance"
            >
              <Scale className="w-4 h-4" />
              <span className="hidden md:inline text-xs">With Balance</span>
            </Button>
          </div>

          <div className="flex items-center gap-2 ">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select
              value={categoryFilter || "all"}
              onValueChange={(value) => {
                setCategoryFilter(value === "all" ? "" : value);
                if (value !== "all" && sortType === "category")
                  onSortChange("name-asc");
              }}
              disabled={!showAllOption}
            >
              <SelectTrigger className="flex-1 text-xs">
                <SelectValue>
                  <>
                    <div className="flex items-center justify-between w-full gap-3">
                      <span>{getCurrentCategoryLabel()}</span>
                      <Badge
                        variant="secondary"
                        className="text-xs hidden sm:inline"
                      >
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
                <SelectItem value="net-desc" className="text-xs">
                  Highest Balance
                </SelectItem>
                <SelectItem value="net-asc" className="text-xs">
                  Lowest Balance
                </SelectItem>
                <SelectItem value="created-desc" className="text-xs">
                  Newest First
                </SelectItem>
                <SelectItem value="created-asc" className="text-xs">
                  Oldest First
                </SelectItem>
                {categoryFilter === "" && showAllOption && (
                  <SelectItem value="category" className="text-xs">
                    Category
                  </SelectItem>
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
    </PageHeader>
  );
};
