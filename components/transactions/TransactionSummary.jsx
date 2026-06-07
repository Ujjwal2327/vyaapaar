"use client";

import { TrendingUp, TrendingDown, Scale } from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n ?? 0);

export const TransactionSummary = ({ summary }) => {
  const { toReceive, toGive, pendingOut, pendingIn, totalPending } = summary;
  const netBalance = toReceive - toGive;

  if (totalPending === 0 && toReceive === 0 && toGive === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 text-center text-muted-foreground text-sm">
        No pending transactions
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {/* To Receive */}
      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-xs text-muted-foreground font-medium truncate">
            Receivable
          </span>
        </div>
        <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400 leading-tight">
          {fmt(toReceive)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {pendingOut} sale{pendingOut !== 1 ? "s" : ""}
        </p>
      </div>

      {/* To Give */}
      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
          <span className="text-xs text-muted-foreground font-medium truncate">
            Payable
          </span>
        </div>
        <p className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400 leading-tight">
          {fmt(toGive)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {pendingIn} purchase{pendingIn !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Net */}
      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-1">
          <Scale
            className={`w-3.5 h-3.5 shrink-0 ${netBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          />
          <span className="text-xs text-muted-foreground font-medium truncate">
            Net
          </span>
        </div>
        <p
          className={`text-lg sm:text-2xl font-bold leading-tight ${netBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
        >
          {netBalance >= 0 ? "+" : ""}
          {fmt(netBalance)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {totalPending} pending
        </p>
      </div>
    </div>
  );
};
