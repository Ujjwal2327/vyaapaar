import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Edit2,
  Table2,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useMemo, memo } from "react";
import { isPivotable, buildPivotData } from "@/lib/utils/pivotTableUtils";
import { PivotTable } from "./PivotTable";

// Per-category "table vs list" and "which axis is which" choices, keyed
// by category path — same "plain object in localStorage, keyed by path"
// shape expandedCategories already uses elsewhere in this feature, so a
// choice made for one category survives collapsing/re-expanding it or
// reloading the page instead of resetting every time.
const VIEW_MODE_STORAGE_KEY = "priceListCategoryViewMode";
const TRANSPOSED_STORAGE_KEY = "priceListCategoryTransposed";

const readPathMap = (storageKey) => {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writePathMap = (storageKey, map) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    // best-effort, same as everywhere else in this app
  }
};

const CategoryItemImpl = ({
  name,
  path,
  node,
  level,
  isExpanded,
  onToggleCategory,
  editMode,
  priceView,
  sellPriceMode,
  onDelete,
  onEdit,
  onViewDetails,
  onAddSubcategory,
  onAddItem,
  onEditCategory,
  onViewCategoryDetails, // New prop
  children,
}) => {
  // Double-tap detection state
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef(null);

  // The table view is only ever offered where the last two levels are
  // "subcategory of items" (see isPivotable) — anything shallower (bare
  // items right under this category) or deeper stays exactly the
  // nested list it always was.
  const pivotable = useMemo(() => isPivotable(node), [node]);

  const [viewMode, setViewMode] = useState(
    () => readPathMap(VIEW_MODE_STORAGE_KEY)[path] ?? "list",
  );
  const [transposed, setTransposed] = useState(
    () => readPathMap(TRANSPOSED_STORAGE_KEY)[path] ?? false,
  );

  const pivotData = useMemo(
    () =>
      pivotable && viewMode === "table" ? buildPivotData(node, path) : null,
    [pivotable, viewMode, node, path],
  );

  const toggleViewMode = (e) => {
    e.stopPropagation();
    setViewMode((prev) => {
      const next = prev === "table" ? "list" : "table";
      const map = readPathMap(VIEW_MODE_STORAGE_KEY);
      map[path] = next;
      writePathMap(VIEW_MODE_STORAGE_KEY, map);
      return next;
    });
  };

  const toggleTransposed = () => {
    setTransposed((prev) => {
      const next = !prev;
      const map = readPathMap(TRANSPOSED_STORAGE_KEY);
      map[path] = next;
      writePathMap(TRANSPOSED_STORAGE_KEY, map);
      return next;
    });
  };

  const handleCategoryClick = () => {
    if (editMode) {
      // In edit mode, just toggle
      onToggleCategory(path);
      return;
    }

    // Not in edit mode - handle double tap
    setTapCount((prev) => prev + 1);

    // Clear existing timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    // Set new timeout
    tapTimeoutRef.current = setTimeout(() => {
      if (tapCount + 1 === 1) {
        // Single tap - toggle expand/collapse
        onToggleCategory(path);
      } else if (tapCount + 1 === 2) {
        // Double tap - view details
        onViewCategoryDetails(path, name);
      }
      setTapCount(0);
    }, 300); // 300ms window for double tap
  };

  return (
    <div className="mb-2">
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={handleCategoryClick}
          className={`flex-1 justify-between ${
            level === 0
              ? "text-xl font-bold"
              : level === 1
                ? "text-lg font-semibold"
                : "text-[1.1rem] font-semibold"
          }`}
          variant="secondary"
        >
          <span>{name}</span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </Button>

        {/* Table / list toggle — sits beside the expand control (not
            inside it) so tapping it doesn't also collapse the category,
            and only appears once there's something expanded to look at
            AND the shape actually fits a pivot table. */}
        {isExpanded && pivotable && (
          <Button
            onClick={toggleViewMode}
            variant="outline"
            size="sm"
            title={
              viewMode === "table"
                ? "Switch to list view"
                : "Switch to table view"
            }
            className="shrink-0"
          >
            {viewMode === "table" ? (
              <Table2 className="w-4 h-4 md:mr-2" />
            ) : (
              <List className="w-4 h-4 md:mr-2" />
            )}
            <span className="hidden md:inline text-sm">
              {viewMode === "table" ? "Table" : "List"}
            </span>
          </Button>
        )}

        {editMode && (
          <div className="flex gap-2">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onEditCategory(path, name);
              }}
              variant="secondary"
              size="icon"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(path, e);
              }}
              variant="destructive"
              size="icon"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="ml-1 mt-2 space-y-2 border-l-2 border-border pl-3">
          {editMode && (
            <div className="flex gap-2">
              <Button
                onClick={() => onAddSubcategory(path)}
                className="flex-1"
                variant="outline"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Subcategory
              </Button>
              <Button
                onClick={() => onAddItem(path)}
                className="flex-1"
                variant="outline"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
          )}

          {pivotable && viewMode === "table" && pivotData ? (
            <PivotTable
              categoryName={name}
              data={pivotData}
              transposed={transposed}
              onToggleTransposed={toggleTransposed}
              priceView={priceView}
              sellPriceMode={sellPriceMode}
              editMode={editMode}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewDetails={onViewDetails}
            />
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
};

export const CategoryItem = memo(CategoryItemImpl);
