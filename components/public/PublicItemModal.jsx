import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { normalizeUnit } from "@/lib/units-config";
import { Package } from "lucide-react";

export const PublicItemModal = ({ open, onOpenChange, itemData, itemName }) => {
  if (!itemData) return null;

  // Handle backward compatibility: use retailSell if available, else fall back to sell
  const retailSell = itemData.retailSell !== undefined ? itemData.retailSell : itemData.sell || 0;
  const { sellUnit: rawSellUnit, notes } = itemData;

  // Normalize units (convert aliases to primary names)
  const sellUnit = normalizeUnit(rawSellUnit || "piece");

  // Function to format the price display
  const formatPrice = (price, unit) => {
    return `₹${price} / ${unit}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            <DialogTitle className="text-2xl">{itemName}</DialogTitle>
          </div>
          <DialogDescription>Item information and details.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Retail Sell Price */}
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-primary">
              Sell Price
            </span>
            <span className="text-lg font-bold">
              {formatPrice(retailSell, sellUnit)}
            </span>
          </div>

          {/* Notes Section */}
          {notes && notes.trim() && (
            <>
              <Separator />
              <div className="pt-2">
                <h4 className="font-semibold mb-2">Notes:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {notes}
                </p>
              </div>
            </>
          )}

          {/* Empty state for no notes */}
          {(!notes || !notes.trim()) && (
            <>
              <Separator />
              <div className="pt-2">
                <p className="text-sm text-muted-foreground italic">
                  No additional information available.
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};