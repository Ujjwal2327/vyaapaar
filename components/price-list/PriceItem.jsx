import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PriceItem = ({
  name,
  path,
  item,
  priceView,
  editMode,
  onEdit,
  onDelete,
}) => {
  const sellUnit = item.sellUnit || "piece";
  const costUnit = item.costUnit || item.sellUnit || "piece";

  let displayValue;
  if (priceView === "sell") {
    displayValue = `₹${item.sell}/${sellUnit}`;
  } else if (priceView === "cost") {
    displayValue = `₹${item.cost}/${costUnit}`;
  } else {
    if (sellUnit === costUnit) {
      const profit = item.sell - item.cost;
      const profitPercent =
        item.cost > 0 ? ((profit / item.cost) * 100).toFixed(1) : 0;
      displayValue = `₹${profit} (${profitPercent}%)`;
    } else {
      displayValue = `N/A (different units)`;
    }
  }

  return (
    <div className="bg-card rounded-lg px-4 py-2.5 flex justify-between items-center hover:bg-accent mb-2 border">
      <span className="flex-1">{name}</span>
      <div className="flex items-center gap-3">
        <span className="font-semibold text-sm">{displayValue}</span>
        {editMode && (
          <div className="flex gap-2">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(path, item);
              }}
              variant="ghost"
              size="icon"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              onClick={(e) => onDelete(path, e)}
              variant="ghost"
              size="icon"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
