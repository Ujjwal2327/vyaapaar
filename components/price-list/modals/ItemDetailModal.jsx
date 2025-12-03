import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const ItemDetailModal = ({ open, onOpenChange, itemData, itemName }) => {
  if (!itemData) return null;

  const { sell, cost, sellUnit, costUnit, notes } = itemData;

  // Function to format the price display
  const formatPrice = (price, unit) => {
    return `₹${price} / ${unit}`;
  };

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
          <div className="flex justify-between items-center border-b pb-2">
            <span className="text-lg font-semibold text-primary">
              Sell Price
            </span>
            <span className="text-lg font-bold">
              {formatPrice(sell, sellUnit)}
            </span>
          </div>

          {/* <div className="flex justify-between items-center border-b pb-2">
            <span className="text-lg font-semibold text-secondary-foreground">
              Cost Price
            </span>
            <span className="text-lg font-medium">
              {formatPrice(cost, costUnit)}
            </span>
          </div> */}

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
