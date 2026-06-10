"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  Zap,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

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
  // Pending transactions with a real positive balance (tier 1).
  // Exclude zero-balance pending transactions — they can't contribute to a
  // settlement and would be shown to the user as eligible when they aren't.
  const pendingTxs = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.status === "pending" &&
          (t.totalAmount ?? 0) - (t.paidAmount ?? 0) > 0,
      ),
    [transactions],
  );

  // Overpaid transactions — they carry an advance balance (tier 2)
  const overpaidTxs = useMemo(
    () => transactions.filter((t) => t.status === "overpaid"),
    [transactions],
  );

  const eligibleTxs = useMemo(
    () => [...pendingTxs, ...overpaidTxs],
    [pendingTxs, overpaidTxs],
  );

  // selectedIds is kept in sync with eligibleTxs whenever the modal opens or
  // the eligible set changes (e.g. after a settlement completes and the modal
  // is opened again). This ensures newly added transactions are pre-selected
  // and transactions that are no longer eligible are removed from the set.
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(eligibleTxs.map((t) => t.id)),
  );

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(eligibleTxs.map((t) => t.id)));
    }
  }, [open, eligibleTxs]);

  // Can settle if we have at least one "receivable source" and one "payable source":
  //   receivable sources: pending out OR overpaid in
  //   payable sources:    pending in  OR overpaid out
  const selectedTxs = useMemo(
    () => eligibleTxs.filter((t) => selectedIds.has(t.id)),
    [eligibleTxs, selectedIds],
  );

  const hasReceivable = selectedTxs.some((t) => {
    const rem = (t.totalAmount ?? 0) - (t.paidAmount ?? 0);
    return (
      (t.type === "out" && t.status === "pending" && rem > 0) ||
      (t.type === "in" && t.status === "overpaid")
    );
  });
  const hasPayable = selectedTxs.some((t) => {
    const rem = (t.totalAmount ?? 0) - (t.paidAmount ?? 0);
    return (
      (t.type === "in" && t.status === "pending" && rem > 0) ||
      (t.type === "out" && t.status === "overpaid")
    );
  });
  const canSettle = hasReceivable && hasPayable;

  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Preview fetch: async, cancellable, with error state so a fetch failure
  // doesn't silently leave the Confirm button permanently disabled.
  const [preview, setPreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const previewCancelRef = useRef(0);

  const runPreview = useCallback(() => {
    if (selectedIds.size < 2) {
      setPreview(null);
      setPreviewError(false);
      return;
    }

    const token = ++previewCancelRef.current;
    setIsPreviewLoading(true);
    setPreviewError(false);

    computeSettlementPreview(Array.from(selectedIds))
      .then((result) => {
        if (token !== previewCancelRef.current) return; // superseded
        setPreview(result);
        setIsPreviewLoading(false);
      })
      .catch(() => {
        if (token !== previewCancelRef.current) return;
        setPreview(null);
        setIsPreviewLoading(false);
        setPreviewError(true);
      });
  }, [selectedIds, computeSettlementPreview]);

  useEffect(() => {
    runPreview();
  }, [runPreview]);

  // Reset preview when modal closes so stale data is never shown on re-open
  // before the fresh fetch lands.
  useEffect(() => {
    if (!open) {
      setPreview(null);
      setPreviewError(false);
      previewCancelRef.current += 1; // cancel any in-flight preview fetch
    }
  }, [open]);

  const affectedCount =
    preview?.previews?.filter((p) => p.settled > 0).length ?? 0;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await onSettle(Array.from(selectedIds));
      // If the fresh DB re-filter dropped transactions that were shown in the
      // preview, let the user know the result differed from what they saw.
      if (result?.staleCount > 0) {
        toast.warning(
          `${result.staleCount} transaction${result.staleCount !== 1 ? "s were" : " was"} already settled or paid — settlement applied to the rest.`,
        );
      }
      // Only close on success. onSettle re-throws on failure so the catch
      // below runs instead and the modal stays open for the user to retry.
      onOpenChange(false);
    } catch {
      // Error toast is already shown by handleSettle in the page.
      // Nothing to do here — modal stays open.
    } finally {
      setIsSubmitting(false);
    }
  };

  const noEligible = eligibleTxs.length === 0;
  const hasOnlyOneSide =
    eligibleTxs.length > 0 && !canSettle && selectedIds.size >= 2;

  // Group label helpers
  const getGroupInfo = (dir, isAdvance) => {
    if (!isAdvance) {
      return dir === "out"
        ? {
            label: "Sales (receivable)",
            icon: TrendingUp,
            color: "text-green-600 dark:text-green-400",
          }
        : {
            label: "Purchases (payable)",
            icon: TrendingDown,
            color: "text-red-600 dark:text-red-400",
          };
    }
    // Overpaid transactions — their role is inverted
    return dir === "out"
      ? {
          label: "Overpaid sales (advance to return)",
          icon: TrendingDown,
          color: "text-amber-600 dark:text-amber-400",
        }
      : {
          label: "Overpaid purchases (advance to receive back)",
          icon: TrendingUp,
          color: "text-blue-600 dark:text-blue-400",
        };
  };

  // Build display groups: [pending out, pending in, overpaid out, overpaid in]
  const groups = [
    {
      txs: pendingTxs.filter((t) => t.type === "out"),
      dir: "out",
      isAdvance: false,
    },
    {
      txs: pendingTxs.filter((t) => t.type === "in"),
      dir: "in",
      isAdvance: false,
    },
    {
      txs: overpaidTxs.filter((t) => t.type === "out"),
      dir: "out",
      isAdvance: true,
    },
    {
      txs: overpaidTxs.filter((t) => t.type === "in"),
      dir: "in",
      isAdvance: true,
    },
  ].filter((g) => g.txs.length > 0);

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
                Offset sales against purchases — including advance balances
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="px-4 py-3 space-y-4">
            {noEligible ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700 dark:text-amber-400">
                  <p className="font-medium mb-0.5">
                    No transactions to settle
                  </p>
                  <p className="text-xs">
                    Need at least one pending transaction and one
                    opposite-direction pending or overpaid transaction.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* How it works */}
                <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">How it works</p>
                  <p>
                    <span className="font-medium text-foreground">Tier 1</span>{" "}
                    — pending sales and purchases cancel each other out
                    directly.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Tier 2</span>{" "}
                    — any leftover advance from an overpaid transaction is used
                    to clear remaining pending dues.
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

                {/* Transaction groups */}
                {groups.map(({ txs, dir, isAdvance }) => {
                  const info = getGroupInfo(dir, isAdvance);
                  const Icon = info.icon;
                  return (
                    <div key={`${dir}-${isAdvance}`} className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-3.5 h-3.5 ${info.color}`} />
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {info.label}
                        </p>
                        {isAdvance && (
                          <Badge className="text-[0.625rem] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 border-0 ml-1">
                            Advance
                          </Badge>
                        )}
                      </div>
                      <div className="border rounded-lg divide-y overflow-hidden">
                        {txs.map((tx) => {
                          const remaining =
                            (tx.totalAmount ?? 0) - (tx.paidAmount ?? 0);
                          const displayAmount = Math.abs(remaining);
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
                                <div className="flex items-center justify-between gap-2 min-w-0">
                                  <p className="text-sm font-medium truncate min-w-0">
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
                                    className={`text-sm font-bold shrink-0 tabular-nums whitespace-nowrap ${info.color}`}
                                  >
                                    {fmt(displayAmount)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-[0.625rem] text-muted-foreground font-mono">
                                    ID: {tx.id.slice(0, 16)}…
                                  </p>
                                  {isAdvance && (
                                    <span className="text-[0.625rem] text-amber-600 dark:text-amber-400 font-medium">
                                      advance
                                    </span>
                                  )}
                                </div>
                                {/* Preview of what will happen */}
                                {isPreviewLoading && isSelected && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      Calculating…
                                    </span>
                                  </div>
                                )}
                                {!isPreviewLoading &&
                                  previewEntry &&
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

                {/* Can't settle warning */}
                {hasOnlyOneSide && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Need both a receivable source (pending sale or overpaid
                      purchase) and a payable source (pending purchase or
                      overpaid sale) selected.
                    </span>
                  </div>
                )}

                {/* Settlement preview summary */}
                {isPreviewLoading && selectedIds.size >= 2 && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Fetching latest balances…
                    </div>
                  </>
                )}

                {!isPreviewLoading && preview && affectedCount > 0 && (
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
                        will be fully settled. Full history recorded on each.
                      </p>
                      {/* Show if advance txs are involved */}
                      {preview.previews.some(
                        (p) => p.isAdvanceTx && p.settled > 0,
                      ) && (
                        <div className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-1.5">
                          <Zap className="w-3 h-3 shrink-0 mt-0.5 text-amber-600" />
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Advance balance from{" "}
                            {
                              preview.previews.filter(
                                (p) => p.isAdvanceTx && p.settled > 0,
                              ).length
                            }{" "}
                            overpaid transaction
                            {preview.previews.filter(
                              (p) => p.isAdvanceTx && p.settled > 0,
                            ).length !== 1
                              ? "s"
                              : ""}{" "}
                            will be applied and consumed.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {selectedIds.size < 2 && (
                  <p className="text-xs text-center text-muted-foreground">
                    Select at least 2 transactions
                  </p>
                )}

                {/* Preview fetch error */}
                {previewError && !isPreviewLoading && selectedIds.size >= 2 && (
                  <>
                    <Separator />
                    <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-red-700 dark:text-red-400">
                          Could not load latest balances
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                          Check your connection and try again.
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs shrink-0 text-red-700 dark:text-red-400 hover:text-red-900"
                        onClick={runPreview}
                      >
                        Retry
                      </Button>
                    </div>
                  </>
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
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 gap-1.5"
            disabled={
              isSubmitting ||
              isPreviewLoading ||
              noEligible ||
              !canSettle ||
              selectedIds.size < 2 ||
              !preview ||
              preview.totalSettled <= 0
            }
            onClick={handleConfirm}
          >
            <CheckCircle2 className="w-4 h-4" />
            {isSubmitting
              ? "Settling…"
              : `Settle ${affectedCount > 0 ? `${affectedCount} transaction${affectedCount !== 1 ? "s" : ""}` : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
