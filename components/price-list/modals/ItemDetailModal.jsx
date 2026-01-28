import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const ItemDetailModal = ({ open, onOpenChange, itemData, itemName }) => {
  if (!itemData) return null;

  // Handle backward compatibility: use retailSell if available, else fall back to sell
  const retailSell = itemData.retailSell !== undefined ? itemData.retailSell : itemData.sell || 0;
  const bulkSell = itemData.bulkSell !== undefined ? itemData.bulkSell : retailSell;
  const { cost, sellUnit, costUnit, notes } = itemData;

  // Function to format the price display
  const formatPrice = (price, unit) => {
    return `₹${price} / ${unit}`;
  };

  // Check if retail and bulk are different
  const hasDifferentBulkPrice = retailSell !== bulkSell;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{itemName}</DialogTitle>
          <DialogDescription>
            Detailed pricing and specification information.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Retail Sell Price */}
          <div className="flex justify-between items-center border-b pb-2">
            <span className="text-lg font-semibold text-primary">
              Retail Sell Price
            </span>
            <span className="text-lg font-bold">
              {formatPrice(retailSell, sellUnit)}
            </span>
          </div>

          {/* Bulk Sell Price - Only show if different from retail */}
          {hasDifferentBulkPrice && (
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                Bulk Sell Price
              </span>
              <span className="text-lg font-bold">
                {formatPrice(bulkSell, sellUnit)}
              </span>
            </div>
          )}

          {/* Notes Section */}
          {notes && (
            <div className="pt-2">
              <h4 className="font-semibold mb-1">Notes:</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {notes || "No additional notes provided."}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};