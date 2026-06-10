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
  Trash2,
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
  const isOverpaid = tx.status === "overpaid";
  const isDeleted = tx.status === "deleted";
  const remaining = (tx.totalAmount ?? 0) - (tx.paidAmount ?? 0);
  const progress =
    tx.totalAmount > 0
      ? Math.min((tx.paidAmount / tx.totalAmount) * 100, 100)
      : 0;
  const createdAt = tx.createdAt
    ? format(new Date(tx.createdAt), "d MMM yy")
    : "";

  const dirColor = isDeleted
    ? "text-muted-foreground"
    : isOut
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
      className={`bg-card rounded-xl border p-4 sm:p-5 cursor-pointer transition-colors ${
        isDeleted
          ? "opacity-60 border-dashed hover:bg-muted/20 active:bg-muted/30"
          : "hover:bg-muted/40 active:bg-muted/60"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* kind icon */}
        <div
          className={`mt-0.5 w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
            isDeleted
              ? "bg-muted"
              : isItem
                ? "bg-blue-100 dark:bg-blue-900/60"
                : "bg-purple-100 dark:bg-purple-900/60"
          }`}
        >
          {isDeleted ? (
            <Trash2 className="w-5 h-5 text-muted-foreground" />
          ) : isItem ? (
            <Package className="w-5 h-5 text-blue-700 dark:text-blue-300" />
          ) : (
            <Banknote className="w-5 h-5 text-purple-700 dark:text-purple-300" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* row 1: direction + amount */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-base font-semibold ${dirColor} flex items-center gap-1 ${isDeleted ? "line-through" : ""}`}
                >
                  {isOut ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {isOut ? "Sale" : "Purchase"}
                </span>
                <Badge
                  variant="outline"
                  className="text-sm px-2 py-0.5 border-0 bg-muted font-normal"
                >
                  {isItem ? "Items" : "Financial"}
                </Badge>
                {isDeleted && (
                  <Badge className="text-sm px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0">
                    Deleted
                  </Badge>
                )}
                {!isDeleted && isOverpaid && (
                  <Badge className="text-sm px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-0">
                    Overpaid
                  </Badge>
                )}
              </div>
              {itemsPreview && (
                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                  {itemsPreview}
                </p>
              )}
              {!itemsPreview && tx.note && (
                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                  {tx.note}
                </p>
              )}
            </div>

            {/* amount */}
            <div className="text-right shrink-0 max-w-[9rem]">
              <p
                className={`text-xl font-bold tabular-nums ${dirColor} ${isDeleted ? "line-through" : ""}`}
              >
                {fmt(tx.totalAmount)}
              </p>
              {!isDeleted && isPending && remaining > 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 tabular-nums">
                  Due {fmt(remaining)}
                </p>
              )}
              {!isDeleted && isOverpaid && (
                <p className="text-sm text-blue-600 dark:text-blue-400 tabular-nums">
                  +{fmt(Math.abs(remaining))} adv.
                </p>
              )}
            </div>
          </div>

          {/* progress bar — hide for deleted */}
          {!isDeleted && tx.paidAmount > 0 && remaining > 0 && (
            <div className="mb-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Paid {fmt(tx.paidAmount)} of {fmt(tx.totalAmount)}
              </p>
            </div>
          )}

          {/* overpayment note — hide for deleted */}
          {!isDeleted && isOverpaid && (
            <div className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
              <p className="text-sm text-amber-700 dark:text-amber-400 break-words min-w-0">
                {overpaidMsg}
              </p>
            </div>
          )}

          {/* status + date */}
          <div className="flex items-center gap-2">
            {isDeleted ? (
              <span className="flex items-center gap-1 text-sm text-red-500 dark:text-red-400">
                <Trash2 className="w-4 h-4" />
                Deleted
              </span>
            ) : isPending ? (
              <span className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
                Pending
              </span>
            ) : isOverpaid ? (
              <span className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
                <AlertTriangle className="w-4 h-4" />
                Overpaid
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                Complete
              </span>
            )}
            <span className="text-sm text-muted-foreground">{createdAt}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
