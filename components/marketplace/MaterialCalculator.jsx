"use client";

/**
 * components/marketplace/MaterialCalculator.jsx
 *
 * "How much do I need?" helper for a single catalog item. The customer
 * enters a quantity in whatever unit is convenient for them — they know
 * they need pipe for a 12 metre run, the item happens to be priced per
 * foot — and sees the equivalent quantity and total price in the item's
 * actual sell unit, with an optional one-tap add to cart.
 *
 * Reuses the same conversion tables as the private catalog's cost/profit
 * view (lib/utils/unitConversion.js) — same categories, same factors, so a
 * customer's estimate and the shop's own numbers never disagree.
 *
 * Collapsed by default and expands inline, the same interaction shape as
 * the "pending item" panel in AddTransactionModal's PriceItemSearch, so it
 * doesn't introduce a new UI pattern the rest of the app doesn't already
 * use.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calculator, Plus, X } from "lucide-react";
import {
  convertQuantity,
  getCompatibleUnits,
} from "@/lib/utils/unitConversion";

const fmt = (n) =>
  `₹${(+n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * item: { name, price, unit }
 * onAddToCart?: (qtyInItemUnit: number) => void — omit to show the
 * calculator read-only, with no add-to-cart action.
 */
export const MaterialCalculator = ({ item, onAddToCart }) => {
  const [open, setOpen] = useState(false);
  const [targetQty, setTargetQty] = useState("");
  const [targetUnit, setTargetUnit] = useState(item.unit || "piece");

  const compatibleUnits = getCompatibleUnits(item.unit || "piece");

  const parsedQty = parseFloat(targetQty);
  const hasQty = targetQty !== "" && !isNaN(parsedQty) && parsedQty > 0;
  const qtyInItemUnit = hasQty
    ? convertQuantity(parsedQty, targetUnit, item.unit || "piece")
    : null;
  const canConvert = qtyInItemUnit !== null;
  const total = canConvert ? qtyInItemUnit * (parseFloat(item.price) || 0) : 0;

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-sm gap-1.5 text-muted-foreground hover:text-foreground px-2 -ml-2"
        onClick={() => setOpen(true)}
      >
        <Calculator className="w-3.5 h-3.5" />
        Need it in a different unit? Calculate
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2.5 mt-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Calculate quantity
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close calculator"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Input
          type="number"
          min="0"
          step="any"
          placeholder="Qty needed"
          value={targetQty}
          onChange={(e) => setTargetQty(e.target.value)}
          className="h-9 w-28 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          autoFocus
        />
        <Select value={targetUnit} onValueChange={setTargetUnit}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {compatibleUnits.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasQty && !canConvert && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {targetUnit} can't convert to {item.unit || "piece"} — this item is
          sold by count, not by that kind of measurement. Enter the quantity
          directly in {item.unit || "piece"} instead.
        </p>
      )}

      {canConvert && qtyInItemUnit > 0 && (
        <div className="rounded-md bg-background border px-3 py-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">You'll need</span>
            <span className="font-semibold tabular-nums">
              {qtyInItemUnit.toFixed(2)} {item.unit || "piece"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estimated cost</span>
            <span className="font-semibold tabular-nums text-primary">
              {fmt(total)}
            </span>
          </div>
        </div>
      )}

      {onAddToCart && canConvert && qtyInItemUnit > 0 && (
        <Button
          type="button"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => {
            onAddToCart(Math.ceil(qtyInItemUnit * 100) / 100);
            setOpen(false);
            setTargetQty("");
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add {qtyInItemUnit.toFixed(2)} {item.unit || "piece"} to cart
        </Button>
      )}
    </div>
  );
};
