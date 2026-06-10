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
      <DialogContent className="max-w-sm p-0 gap-0 flex flex-col h-[90svh] overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Record Payment
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="rounded-lg bg-muted/50 border p-4 text-center space-y-1.5">
              <p className="text-sm text-muted-foreground">Remaining balance</p>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                {fmt(remaining)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-sm text-muted-foreground h-7 px-2"
                onClick={() => setAmount(remaining.toString())}
              >
                Pay full amount
              </Button>
            </div>

            <div>
              <Label className="text-base font-medium mb-1 block">
                Amount (₹)
              </Label>
              <p className="text-sm text-muted-foreground mb-2">
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
                className="text-xl h-12"
              />

              {isOverpaid && (
                <div className="flex items-start gap-2 mt-2 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Paying <strong>{fmt(paidNow)}</strong> exceeds remaining{" "}
                    <strong>{fmt(remaining)}</strong>. Advance of{" "}
                    <strong>{fmt(paidNow - remaining)}</strong> will be
                    recorded.
                  </span>
                </div>
              )}
            </div>

            <div>
              <Label className="text-base font-medium mb-1 block">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-10">
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
              <Label className="text-base font-medium mb-1 block">
                Note (optional)
              </Label>
              <Input
                placeholder="e.g. Received via Paytm"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-10"
              />
            </div>

            {isValid && (
              <div className="rounded-lg border p-3 space-y-1.5 text-sm">
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
          </div>
        </div>

        {/* Sticky footer */}
        <div className="border-t px-4 py-3 flex gap-2 shrink-0 bg-background">
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
      </DialogContent>
    </Dialog>
  );
};
