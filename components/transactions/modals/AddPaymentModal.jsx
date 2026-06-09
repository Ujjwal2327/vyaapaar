"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { CreditCard, AlertTriangle } from "lucide-react";

const PAYMENT_METHODS = ["cash", "UPI", "bank transfer", "cheque", "credit"];

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n ?? 0);

export const AddPaymentModal = ({
  open,
  onOpenChange,
  transaction,
  onSave,
}) => {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!transaction) return null;

  const remaining =
    (transaction.totalAmount ?? 0) - (transaction.paidAmount ?? 0);
  const paidNow = parseFloat(amount) || 0;
  // Fire the overpayment warning whenever paidNow would push past the total,
  // regardless of whether the transaction is already overpaid (remaining <= 0).
  // When remaining <= 0 the transaction already carries an advance balance, so
  // any further payment adds to it — the warning should still appear.
  const isOverpaid = paidNow > 0 && paidNow > remaining;
  const afterPayment = remaining - paidNow;

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSave({ amount: paidNow, method, note });
      setAmount("");
      setMethod("cash");
      setNote("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = paidNow > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Record Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 border p-3 text-center space-y-1">
            <p className="text-xs text-muted-foreground">Remaining balance</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {fmt(remaining)}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-6 px-2"
              onClick={() => setAmount(remaining.toString())}
            >
              Pay full amount
            </Button>
          </div>

          <div>
            <Label className="text-sm font-medium mb-1 block">Amount (₹)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Can exceed remaining balance — the extra will be tracked as
              advance.
            </p>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              className="text-lg"
            />

            {isOverpaid && (
              <div className="flex items-start gap-2 mt-2 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Paying <strong>{fmt(paidNow)}</strong> exceeds remaining{" "}
                  <strong>{fmt(remaining)}</strong>. Advance of{" "}
                  <strong>{fmt(paidNow - remaining)}</strong> will be recorded.
                </span>
              </div>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium mb-1 block">Method</Label>
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
              Note (optional)
            </Label>
            <Input
              placeholder="e.g. Received via Paytm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {isValid && (
            <div className="rounded-lg border p-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Paying now</span>
                <span className="text-green-600 font-medium">
                  {fmt(paidNow)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>
                  {afterPayment < 0 ? "Advance recorded" : "Still owed after"}
                </span>
                <span
                  className={
                    afterPayment < 0
                      ? "text-blue-600 dark:text-blue-400 font-medium"
                      : afterPayment === 0
                        ? "text-green-600 font-medium"
                        : "text-amber-600 font-medium"
                  }
                >
                  {afterPayment < 0
                    ? fmt(Math.abs(afterPayment))
                    : fmt(afterPayment)}
                  {afterPayment === 0 && " (fully paid)"}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!isValid || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? "Saving…" : "Save Payment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
