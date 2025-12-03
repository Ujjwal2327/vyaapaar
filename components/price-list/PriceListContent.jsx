import { CategoryItem } from "./CategoryItem";
import { PriceItem } from "./PriceItem";

export const PriceListContent = ({
  data,
  priceView,
  editMode,
  expandedCategories,
  onToggleCategory,
  onDelete,
  onEdit,
  onAddSubcategory,
  onAddItem,
  onEditCategory,
  onViewDetails,
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
          <CategoryItem
            key={currentPath}
            name={key}
            path={currentPath}
            level={currentLevel}
            isExpanded={isExpanded}
            onToggle={() => onToggleCategory(currentPath)}
            editMode={editMode}
            onDelete={onDelete}
            onAddSubcategory={onAddSubcategory}
            onAddItem={onAddItem}
            onEditCategory={onEditCategory}
          >
            {value.children &&
              renderItems(value.children, currentPath, currentLevel + 1)}
          </CategoryItem>
        );
      } else if (value.type === "item") {
        return (
          <PriceItem
            key={currentPath}
            isLast={index === Object.keys(items).length - 1}
            name={key}
            path={currentPath}
            item={value}
            priceView={priceView}
            editMode={editMode}
            onEdit={onEdit}
            onDelete={onDelete}
            onViewDetails={onViewDetails}
          />
        );
      }
      return null;
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-2">
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
