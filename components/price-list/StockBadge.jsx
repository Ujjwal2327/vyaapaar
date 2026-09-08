import { isStockTracked, getStockStatus } from "@/lib/utils/stockUtils";

/**
 * Small pill showing an item's current stock level. Renders nothing for
 * untracked items. Shared between the catalog list (PriceItem) and the
 * transaction item-search / quantity-entry UI (AddTransactionModal,
 * TransactionDetailModal) so "how much is on hand" reads the same way
 * everywhere it shows up.
 */
export const StockBadge = ({ item, className = "" }) => {
  if (!isStockTracked(item)) return null;
  const status = getStockStatus(item);

  if (status === "ok") {
    return (
      <span
        className={`text-[0.7em] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium shrink-0 whitespace-nowrap ${className}`}
      >
        {item.stockQty} in stock
      </span>
    );
  }

  const isOut = status === "out";
  return (
    <span
      className={`text-[0.7em] px-1.5 py-0.5 rounded-full font-medium shrink-0 whitespace-nowrap ${
        isOut
          ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
      } ${className}`}
    >
      {isOut ? "Out of stock" : `Low: ${item.stockQty}`}
    </span>
  );
};
