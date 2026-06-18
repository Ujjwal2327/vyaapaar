"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  UserPlus,
  User,
  Search,
  X,
  TrendingUp,
  TrendingDown,
  Package,
  Banknote,
  Check,
} from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n ?? 0);

// ─── ContactSearchField ───────────────────────────────────────────────────────
// Single-select search box used to pick the target contact for the batch.
const ContactSearchField = ({ peopleData, selected, onSelect }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const blurTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(blurTimerRef.current), []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return peopleData
      .filter((p) => q === "" || p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [peopleData, query]);

  const handleFocus = useCallback(() => {
    clearTimeout(blurTimerRef.current);
    setOpen(true);
  }, []);
  const handleBlur = useCallback(() => {
    blurTimerRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <User className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{selected.name}</p>
            <p className="text-sm text-muted-foreground capitalize">
              {selected.category}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title="Change contact"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search contacts…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="w-full pl-10 pr-8 h-10 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {query && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setQuery("");
            inputRef.current?.focus();
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      {open && (
        <div className="absolute z-[200] top-full mt-1 left-0 right-0 rounded-md border bg-popover shadow-lg overflow-hidden">
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">
              {query ? `No contacts matching "${query}"` : "No contacts yet"}
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {filtered.map((p) => {
                const phone = (p.phones ?? []).find((ph) => ph?.trim()) ?? null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(p);
                      setQuery("");
                      setOpen(false);
                    }}
                    className="w-full px-3 py-2.5 text-sm hover:bg-accent active:bg-accent text-left flex items-start gap-2 transition-colors"
                  >
                    <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-sm text-muted-foreground">
                        <span className="capitalize">{p.category}</span>
                        {phone && <span> · {phone}</span>}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── main modal ───────────────────────────────────────────────────────────────
// Bulk-assigns a single chosen contact to several unassigned (no-contact)
// transactions at once. Pre-selects every eligible transaction passed in via
// `initialSelectedIds` (e.g. when opened from a multi-select action on the
// Unassigned list), but the user can narrow the selection further here.
export const AssignContactModal = ({
  open,
  onOpenChange,
  transactions = [],
  initialSelectedIds,
  onAssign,
  peopleData = [],
}) => {
  // Only transactions with no contact and not deleted are eligible at all.
  const eligibleTxs = useMemo(
    () => transactions.filter((t) => !t.contactId && t.status !== "deleted"),
    [transactions],
  );

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [targetContact, setTargetContact] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initial =
      initialSelectedIds && initialSelectedIds.length > 0
        ? initialSelectedIds.filter((id) =>
            eligibleTxs.some((t) => t.id === id),
          )
        : eligibleTxs.map((t) => t.id);
    setSelectedIds(new Set(initial));
    setTargetContact(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleId = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(eligibleTxs.map((t) => t.id)));
  const selectNone = () => setSelectedIds(new Set());

  const handleConfirm = async () => {
    if (!targetContact || selectedIds.size === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAssign(Array.from(selectedIds), targetContact.id);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const noEligible = eligibleTxs.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg p-0 gap-0 flex flex-col h-[90svh] overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 pt-4 pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base">Assign Contact</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                Attach a contact to one or more unassigned transactions
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-4 py-3 space-y-4">
            {noEligible ? (
              <p className="text-sm text-center text-muted-foreground py-8">
                No unassigned unassigned transactions to attach a contact to.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-base font-medium">Contact</p>
                  <ContactSearchField
                    peopleData={peopleData}
                    selected={targetContact}
                    onSelect={setTargetContact}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-base font-medium">
                    Transactions ({selectedIds.size}/{eligibleTxs.length})
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-sm"
                      onClick={selectAll}
                    >
                      All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-sm"
                      onClick={selectNone}
                    >
                      None
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg divide-y overflow-hidden">
                  {eligibleTxs.map((tx) => {
                    const isSelected = selectedIds.has(tx.id);
                    const isOut = tx.type === "out";
                    const previewName =
                      tx.kind === "item" && tx.itemsList?.length > 0
                        ? (tx.itemsList[0].name || "")
                            .split(" › ")
                            .pop()
                            .concat(
                              tx.itemsList.length > 1
                                ? ` +${tx.itemsList.length - 1}`
                                : "",
                            )
                        : tx.note ||
                          (tx.kind === "item" ? "Items" : "Financial");
                    return (
                      <label
                        key={tx.id}
                        className={`flex items-start gap-3 px-3 py-3 cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleId(tx.id)}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <p className="text-sm font-medium truncate flex items-center gap-1.5 min-w-0">
                              {tx.kind === "item" ? (
                                <Package className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              ) : (
                                <Banknote className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              )}
                              <span className="truncate">{previewName}</span>
                            </p>
                            <p
                              className={`text-sm font-semibold shrink-0 tabular-nums flex items-center gap-1 ${
                                isOut
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {isOut ? (
                                <TrendingUp className="w-3.5 h-3.5" />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5" />
                              )}
                              {fmt(tx.totalAmount)}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 capitalize">
                            {tx.status}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <div className="border-t px-4 py-3 flex items-center gap-2 bg-background">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 gap-1.5"
            disabled={
              isSubmitting ||
              noEligible ||
              !targetContact ||
              selectedIds.size === 0
            }
            onClick={handleConfirm}
          >
            <Check className="w-4 h-4" />
            {isSubmitting
              ? "Assigning…"
              : `Assign ${selectedIds.size > 0 ? selectedIds.size : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
