"use client";

import { Badge } from "@/components/ui/badge";
import {
  Package,
  Banknote,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n ?? 0);

export const TransactionCard = ({ transaction: tx, onClick }) => {
  const isItem = tx.kind === "item";
  const isOut = tx.type === "out";
  const isPending = tx.status === "pending";
  const remaining = (tx.totalAmount ?? 0) - (tx.paidAmount ?? 0);
  const isOverpaid = remaining < 0;
  const progress =
    tx.totalAmount > 0
      ? Math.min((tx.paidAmount / tx.totalAmount) * 100, 100)
      : 0;
  const createdAt = tx.createdAt
    ? format(new Date(tx.createdAt), "d MMM yy")
    : "";

  const dirColor = isOut
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";

  const overpaidMsg = isOut
    ? `Customer overpaid ${fmt(Math.abs(remaining))}`
    : `We overpaid ${fmt(Math.abs(remaining))}`;

  // item preview: show last path segment only for brevity
  const itemsPreview =
    isItem && tx.itemsList?.length > 0
      ? tx.itemsList
          .slice(0, 2)
          .map((it) => (it.name || "").split(" › ").pop())
          .filter(Boolean)
          .join(", ") +
        (tx.itemsList.length > 2 ? ` +${tx.itemsList.length - 2}` : "")
      : null;

  return (
    <div
      onClick={onClick}
      className="bg-card rounded-xl border p-3 sm:p-4 cursor-pointer hover:bg-muted/40 active:bg-muted/60 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* kind icon */}
        <div
          className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            isItem
              ? "bg-blue-100 dark:bg-blue-900/60"
              : "bg-purple-100 dark:bg-purple-900/60"
          }`}
        >
          {isItem ? (
            <Package className="w-4 h-4 text-blue-700 dark:text-blue-300" />
          ) : (
            <Banknote className="w-4 h-4 text-purple-700 dark:text-purple-300" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* row 1: direction + amount */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-sm font-semibold ${dirColor} flex items-center gap-0.5`}
                >
                  {isOut ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {isOut ? "Sale" : "Purchase"}
                </span>
                <Badge
                  variant="outline"
                  className="text-xs px-1.5 py-0 h-5 border-0 bg-muted font-normal"
                >
                  {isItem ? "Items" : "Financial"}
                </Badge>
                {isOverpaid && (
                  <Badge className="text-xs px-1.5 py-0 h-5 bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-0">
                    Overpaid
                  </Badge>
                )}
              </div>
              {itemsPreview && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {itemsPreview}
                </p>
              )}
              {!itemsPreview && tx.note && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {tx.note}
                </p>
              )}
            </div>

            {/* amount */}
            <div className="text-right shrink-0">
              <p className={`text-base font-bold ${dirColor}`}>
                {fmt(tx.totalAmount)}
              </p>
              {isPending && remaining > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Due {fmt(remaining)}
                </p>
              )}
              {isOverpaid && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  +{fmt(Math.abs(remaining))} adv.
                </p>
              )}
            </div>
          </div>

          {/* progress bar */}
          {tx.paidAmount > 0 && remaining > 0 && (
            <div className="mb-1.5">
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Paid {fmt(tx.paidAmount)} of {fmt(tx.totalAmount)}
              </p>
            </div>
          )}

          {/* overpayment note */}
          {isOverpaid && (
            <div className="flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-1 mb-1.5">
              <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {overpaidMsg}
              </p>
            </div>
          )}

          {/* status + date */}
          <div className="flex items-center gap-2">
            {isPending ? (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <Clock className="w-3 h-3" />
                Pending
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                Complete
              </span>
            )}
            <span className="text-xs text-muted-foreground">{createdAt}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
