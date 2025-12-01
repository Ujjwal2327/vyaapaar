import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  children,
}) => {
  return (
    <div className="mb-2">
      <div className="flex gap-2">
        <Button
          onClick={onToggle}
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
