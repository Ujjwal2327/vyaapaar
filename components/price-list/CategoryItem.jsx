import { ChevronDown, ChevronUp, Plus, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";

export const CategoryItem = ({
  name,
  path,
  level,
  isExpanded,
  onToggle,
  editMode,
  onDelete,
  onAddSubcategory,
  onAddItem,
  onEditCategory,
  onViewCategoryDetails, // New prop for viewing category details
  children,
}) => {
  // Double-tap detection state
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef(null);

  const handleCategoryClick = () => {
    if (editMode) {
      // In edit mode, just toggle
      onToggle();
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
        onToggle();
      } else if (tapCount + 1 === 2) {
        // Double tap - view details
        onViewCategoryDetails(path, name);
      }
      setTapCount(0);
    }, 300); // 300ms window for double tap
  };

  return (
    <div className="mb-2">
      <div className="flex gap-2">
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
          {children}
        </div>
      )}
    </div>
  );
};