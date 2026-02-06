import { normalizeUnit } from "@/lib/units-config";

export const PublicPriceItem = ({ isLast, name, item, onViewDetails }) => {
  // Normalize units (convert aliases to primary names)
  const sellUnit = normalizeUnit(item.sellUnit || "piece");

  // Handle backward compatibility: use retailSell if available, else fall back to sell
  const retailSell = item.retailSell !== undefined ? item.retailSell : item.sell || 0;

  const displayValue = `₹${retailSell}/${sellUnit}`;

  return (
    <div
      className={`rounded-lg px-1 py-2.5 flex justify-between items-center mb-2 gap-2 ${
        isLast ? "" : "border-b"
      } cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors`}
      onClick={() => onViewDetails()}
    >
      <span className="flex-1">{name}</span>
      <span className="font-semibold text-primary">{displayValue}</span>
    </div>
  );
};