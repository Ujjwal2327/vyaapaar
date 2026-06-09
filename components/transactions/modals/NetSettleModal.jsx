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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  Banknote,
  CheckCircle2,
  ArrowRight,
  Zap,
  AlertCircle,
} from "lucide-react";

const PAYMENT_METHODS = ["cash", "UPI", "bank transfer", "cheque", "credit"];

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n ?? 0);

// Summarise the pending/overpaid transactions that will be settled
const buildBreakdown = (transactions) => {
  const active = transactions.filter((t) => t.status !== "deleted");
  const items = [];

  for (const tx of active) {
    const rem = (tx.totalAmount ?? 0) - (tx.paidAmount ?? 0);
    if (tx.status === "pending" && rem > 0) {
      items.push({
        id: tx.id,
        label: tx.type === "out" ? "Sale" : "Purchase",
        isOut: tx.type === "out",
        amount: rem,
        isAdvance: false,
        note: tx.note,
        itemsList: tx.itemsList,
        kind: tx.kind,
      });
    } else if (tx.status === "overpaid") {
      items.push({
        id: tx.id,
        label: tx.type === "out" ? "Overpaid sale" : "Overpaid purchase",
        isOut: tx.type === "out",
        amount: Math.abs(rem),
        isAdvance: true,
        note: tx.note,
        itemsList: tx.itemsList,
        kind: tx.kind,
      });
    }
  }

  return items;
};

export const NetSettleModal = ({
  open,
  onOpenChange,
  transactions,
  summary,
  onNetSettle,
}) => {
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toReceive, toGive } = summary;
  const netAmount = toReceive - toGive;
  const netPositive = netAmount > 0; // true = contact owes us; false = we owe contact

  const breakdown = useMemo(() => buildBreakdown(transactions), [transactions]);
  const settleCount = breakdown.length;

  // What direction the balancing transaction will be
  // net > 0 → contact pays us → "in" payment recorded
  // net < 0 → we pay contact → "out" payment recorded
  const balancingDirection = netPositive ? "in" : "out";
  const balancingLabel = netPositive
    ? "Payment received from contact"
    : "Payment sent to contact";

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onNetSettle({ note, method });
      setNote("");
      setMethod("cash");
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (Math.abs(netAmount) < 0.01) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/60 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <DialogTitle className="text-base">Net Settle</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Record one payment and clear all pending balances
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-4 py-3 space-y-4">
          {/* Net amount hero */}
          <div className="rounded-xl border bg-muted/40 p-4 text-center space-y-1">
            <p className="text-xs text-muted-foreground">
              {netPositive ? "Contact owes you" : "You owe contact"}
            </p>
            <p
              className={`text-3xl font-bold tabular-nums ${
                netPositive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {fmt(Math.abs(netAmount))}
            </p>
            <p className="text-xs text-muted-foreground">
              = {fmt(toReceive)} receivable − {fmt(toGive)} payable
            </p>
          </div>

          {/* What will happen */}
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5 space-y-2">
            <p className="text-xs font-medium text-foreground">What happens</p>

            {/* Step 1: new financial tx */}
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Banknote className="w-3 h-3 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-foreground font-medium">
                  New financial transaction added
                </p>
                <p className="text-xs text-muted-foreground">
                  {balancingLabel} — {fmt(Math.abs(netAmount))} marked as paid
                </p>
              </div>
              <Badge
                className={`shrink-0 text-[10px] px-1.5 py-0 h-4 border-0 ml-auto ${
                  balancingDirection === "in"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300"
                }`}
              >
                {balancingDirection === "in" ? (
                  <TrendingDown className="w-2.5 h-2.5 mr-0.5 inline" />
                ) : (
                  <TrendingUp className="w-2.5 h-2.5 mr-0.5 inline" />
                )}
                {balancingDirection === "in" ? "Income" : "Expense"}
              </Badge>
            </div>

            {/* Step 2: settle all */}
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-3 h-3 text-primary" />
              </div>
              <p className="text-xs text-foreground font-medium">
                {settleCount} transaction{settleCount !== 1 ? "s" : ""} settled
                automatically
              </p>
            </div>
          </div>

          {/* Transaction breakdown */}
          {breakdown.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Transactions being settled
              </p>
              <div className="border rounded-lg divide-y overflow-hidden max-h-36 overflow-y-auto">
                {breakdown.map((item) => {
                  const previewName =
                    item.kind === "item" && item.itemsList?.length > 0
                      ? (item.itemsList[0].name || "")
                          .split(" › ")
                          .pop()
                          .concat(
                            item.itemsList.length > 1
                              ? ` +${item.itemsList.length - 1}`
                              : "",
                          )
                      : item.note || item.label;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 px-3 py-2 text-xs"
                    >
                      {item.isOut ? (
                        <TrendingUp className="w-3 h-3 shrink-0 text-green-600 dark:text-green-400" />
                      ) : (
                        <TrendingDown className="w-3 h-3 shrink-0 text-red-600 dark:text-red-400" />
                      )}
                      <span className="flex-1 truncate text-muted-foreground">
                        {previewName}
                      </span>
                      {item.isAdvance && (
                        <Badge className="text-[9px] px-1 py-0 h-3.5 bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 border-0 shrink-0">
                          advance
                        </Badge>
                      )}
                      <span
                        className={`tabular-nums font-medium shrink-0 ${
                          item.isOut
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {fmt(item.amount)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Separator />

          {/* Payment details */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium mb-1 block">
                Payment method
              </Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium mb-1 block">
                Note{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                placeholder="e.g. Final payment via UPI"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          {/* Warning for non-round numbers */}
          {netAmount !== Math.round(netAmount) && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Net amount includes paise. Confirm the exact figure with the
                contact before settling.
              </span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
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
              onClick={handleConfirm}
              disabled={isSubmitting}
            >
              <Zap className="w-4 h-4" />
              {isSubmitting
                ? "Settling…"
                : `Settle ${fmt(Math.abs(netAmount))}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
