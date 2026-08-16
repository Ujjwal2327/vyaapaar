"use client";

/**
 * components/marketplace/QuantityStepper.jsx
 *
 * The primary way to put an item in the cart: a "+ Add" button when
 * nothing's there yet, becoming a plain number input flanked by -/+ once
 * something has been added — so typing "200" works directly instead of
 * tapping an increment button 200 times, and the current quantity is
 * always visible on the listing itself without opening the cart to check.
 *
 * Deliberately has no unit selector. Quantity here is always a plain
 * count in the item's own listed unit — if someone genuinely needs to
 * work out a quantity from a different unit (e.g. "I know the run in
 * metres, this pipe is priced per foot"), that's what MaterialCalculator
 * is for, reached through its own explicit, clearly-secondary link. This
 * component and that one intentionally don't share a control: one is the
 * fast path, the other is the occasional conversion tool.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";

/**
 * qty: current quantity in cart for this item (0 if not added)
 * unit: item's own unit, used only for the input's aria-label
 * onAdd: () => void — called on the very first tap, from 0
 * onChange: (nextQty: number) => void — called for every subsequent
 *   change (-, +, or typing a number and blurring/pressing Enter)
 */
export const QuantityStepper = ({ qty, unit, onAdd, onChange }) => {
  const [draft, setDraft] = useState(qty > 0 ? String(qty) : "");

  // Keep the typed draft in sync when qty changes from elsewhere (e.g. the
  // Material Calculator adding on top, or the same item edited from the
  // cart dialog) — but only when not actively focused/mid-edit, so we
  // don't yank text out from under someone still typing.
  useEffect(() => {
    setDraft(qty > 0 ? String(qty) : "");
  }, [qty]);

  const commit = (value) => {
    const trimmed = value.trim();
    if (trimmed === "") {
      onChange(0);
      return;
    }
    const n = parseFloat(trimmed);
    onChange(isNaN(n) || n < 0 ? 0 : n);
  };

  if (qty <= 0) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1 shrink-0"
        onClick={onAdd}
      >
        <Plus className="w-3.5 h-3.5" />
        Add
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(Math.max(0, qty - 1))}
        aria-label="Decrease quantity"
      >
        <Minus className="w-3.5 h-3.5" />
      </Button>
      <input
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label={`Quantity${unit ? ` in ${unit}` : ""}`}
        className="w-14 h-8 text-center text-sm rounded-md border border-input bg-background tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(qty + 1)}
        aria-label="Increase quantity"
      >
        <Plus className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
};
