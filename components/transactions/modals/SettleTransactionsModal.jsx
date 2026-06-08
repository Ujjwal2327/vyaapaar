"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n ?? 0);

export const SettleTransactionsModal = ({
  open,
  onOpenChange,
  transactions,
  computeSettlementPreview,
  onSettle,
}) => {
  // Only show pending transactions that have a remaining balance
  const eligibleTxs = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.status === "pending" &&
          (t.totalAmount ?? 0) - (t.paidAmount ?? 0) > 0,
      ),
    [transactions],
  );

  // Default: select all eligible
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(eligibleTxs.map((t) => t.id)),
  );

  const hasOut = eligibleTxs.some((t) => t.type === "out");
  const hasIn = eligibleTxs.some((t) => t.type === "in");
  const canSettle = hasOut && hasIn;

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

  const preview = useMemo(() => {
    if (selectedIds.size < 2) return null;
    return computeSettlementPreview(Array.from(selectedIds));
  }, [selectedIds, computeSettlementPreview]);

  const affectedCount =
    preview?.previews?.filter((p) => p.settled > 0).length ?? 0;

  const handleConfirm = async () => {
    await onSettle(Array.from(selectedIds));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-base">
                Auto-Settle Transactions
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Offset sales against purchases without exchanging cash
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="px-4 py-3 space-y-4">
            {!canSettle ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700 dark:text-amber-400">
                  <p className="font-medium mb-0.5">Settlement not possible</p>
                  <p className="text-xs">
                    {!hasOut && !hasIn
                      ? "No pending transactions to settle."
                      : !hasOut
                        ? "No pending sales (receivables) found. Need both sales and purchases to settle."
                        : "No pending purchases (payables) found. Need both sales and purchases to settle."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* How it works */}
                <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">
                    How it works
                  </p>
                  <p>
                    Sales (money owed to you) and purchases (money you owe)
                    cancel each other out. The difference, if any, remains as
                    the new pending balance. Full history is recorded.
                  </p>
                </div>

                {/* Select All / None */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Select transactions ({selectedIds.size}/{eligibleTxs.length}
                    )
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={selectAll}
                    >
                      All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={selectNone}
                    >
                      None
                    </Button>
                  </div>
                </div>

                {/* Transaction list — grouped by direction */}
                {["out", "in"].map((dir) => {
                  const group = eligibleTxs.filter((t) => t.type === dir);
                  if (!group.length) return null;
                  return (
                    <div key={dir} className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        {dir === "out" ? (
                          <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                        )}
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {dir === "out"
                            ? "Sales (receivable)"
                            : "Purchases (payable)"}
                        </p>
                      </div>
                      <div className="border rounded-lg divide-y overflow-hidden">
                        {group.map((tx) => {
                          const remaining =
                            (tx.totalAmount ?? 0) - (tx.paidAmount ?? 0);
                          const isSelected = selectedIds.has(tx.id);
                          const previewEntry = preview?.previews?.find(
                            (p) => p.tx.id === tx.id,
                          );
                          return (
                            <label
                              key={tx.id}
                              className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                                isSelected
                                  ? "bg-primary/5"
                                  : "hover:bg-muted/50"
                              }`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleId(tx.id)}
                                className="mt-0.5 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium truncate">
                                    {tx.kind === "item" &&
                                    tx.itemsList?.length > 0
                                      ? tx.itemsList
                                          .slice(0, 1)
                                          .map((it) =>
                                            (it.name || "").split(" › ").pop(),
                                          )
                                          .join(", ") +
                                        (tx.itemsList.length > 1
                                          ? ` +${tx.itemsList.length - 1}`
                                          : "")
                                      : tx.note ||
                                        (tx.kind === "financial"
                                          ? "Financial"
                                          : "Items")}
                                  </p>
                                  <p
                                    className={`text-sm font-bold shrink-0 ${
                                      dir === "out"
                                        ? "text-green-600 dark:text-green-400"
                                        : "text-red-600 dark:text-red-400"
                                    }`}
                                  >
                                    {fmt(remaining)}
                                  </p>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  ID: {tx.id.slice(0, 16)}…
                                </p>
                                {/* Preview of what will happen */}
                                {previewEntry &&
                                  previewEntry.settled > 0 &&
                                  isSelected && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <span className="text-xs text-muted-foreground line-through">
                                        {fmt(previewEntry.oldRemaining)}
                                      </span>
                                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                      <span
                                        className={`text-xs font-medium ${
                                          previewEntry.willComplete
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-amber-600"
                                        }`}
                                      >
                                        {previewEntry.willComplete
                                          ? "Fully settled ✓"
                                          : fmt(previewEntry.newRemaining) +
                                            " remaining"}
                                      </span>
                                    </div>
                                  )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Settlement preview summary */}
                {preview && affectedCount > 0 && (
                  <>
                    <Separator />
                    <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                          Settlement preview
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg bg-white dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800 px-3 py-2 text-center">
                          <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                            {fmt(preview.totalSettled)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Total offset
                          </p>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800 px-3 py-2 text-center">
                          <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                            {affectedCount}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Transactions affected
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {preview.previews.filter((p) => p.willComplete).length}{" "}
                        transaction
                        {preview.previews.filter((p) => p.willComplete)
                          .length !== 1
                          ? "s"
                          : ""}{" "}
                        will be fully settled. History will be recorded on each.
                      </p>
                    </div>
                  </>
                )}

                {selectedIds.size < 2 && (
                  <p className="text-xs text-center text-muted-foreground">
                    Select at least 2 transactions (including both a sale and a
                    purchase)
                  </p>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-4 py-3 flex items-center gap-2 bg-background">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 gap-1.5"
            disabled={
              !canSettle ||
              selectedIds.size < 2 ||
              !preview ||
              preview.totalSettled <= 0
            }
            onClick={handleConfirm}
          >
            <CheckCircle2 className="w-4 h-4" />
            Settle {affectedCount > 0 ? `${affectedCount} transactions` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
