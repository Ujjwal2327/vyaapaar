import { PublicCategoryItem } from "./PublicCategoryItem";
import { PublicPriceItem } from "./PublicPriceItem";
import { getItemAtPath } from "@/lib/utils/priceListUtils";

export const PublicPriceListContent = ({
  data,
  expandedCategories,
  onToggleCategory,
  onViewItem,
  onViewCategory,
  parentPath = "",
  level = 0,
}) => {
  const renderItems = (items, currentParentPath, currentLevel) => {
    return Object.entries(items).map(([key, value], index) => {
      const currentPath = currentParentPath
        ? `${currentParentPath}.${key}`
        : key;
      const isExpanded = expandedCategories[currentPath];

      if (value.type === "category") {
        return (
          <PublicCategoryItem
            key={currentPath}
            name={key}
            path={currentPath}
            level={currentLevel}
            isExpanded={isExpanded}
            onToggle={() => onToggleCategory(currentPath)}
            onViewDetails={() => onViewCategory(key, value.notes || "")}
          >
            {value.children &&
              renderItems(value.children, currentPath, currentLevel + 1)}
          </PublicCategoryItem>
        );
      } else if (value.type === "item") {
        return (
          <PublicPriceItem
            key={currentPath}
            isLast={index === Object.keys(items).length - 1}
            name={key}
            item={value}
            onViewDetails={() => onViewItem(key, value)}
          />
        );
      }
      return null;
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-2 pb-8">
      {Object.keys(data).length > 0 ? (
        renderItems(data, parentPath, level)
      ) : (
        <div className="bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">No items found</p>
        </div>
      )}
    </div>
  );
};