"use client";

import { TrendingUp, TrendingDown, Scale } from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n ?? 0);

export const TransactionSummary = ({ summary }) => {
  const {
    toReceive,
    toGive,
    pendingOut,
    pendingIn,
    totalPending,
    overpaidOut = 0,
    overpaidIn = 0,
  } = summary;
  const netBalance = toReceive - toGive;

  // Build sub-labels showing what's contributing to each column
  const receivableParts = [];
  if (pendingOut > 0)
    receivableParts.push(`${pendingOut} sale${pendingOut !== 1 ? "s" : ""}`);
  if (overpaidIn > 0)
    receivableParts.push(
      `${overpaidIn} advance${overpaidIn !== 1 ? "s" : ""} due back`,
    );

  const payableParts = [];
  if (pendingIn > 0)
    payableParts.push(`${pendingIn} purchase${pendingIn !== 1 ? "s" : ""}`);
  if (overpaidOut > 0)
    payableParts.push(
      `${overpaidOut} advance${overpaidOut !== 1 ? "s" : ""} to return`,
    );

  const totalPendingAll = totalPending + overpaidOut + overpaidIn;

  if (totalPendingAll === 0 && toReceive === 0 && toGive === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 text-center text-muted-foreground text-base">
        No pending transactions
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {/* Receivable */}
      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-sm text-muted-foreground font-medium truncate">
            Receivable
          </span>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400 leading-tight">
          {fmt(toReceive)}
        </p>
        <p className="text-sm text-muted-foreground mt-1 leading-tight">
          {receivableParts.length > 0 ? receivableParts.join(", ") : "—"}
        </p>
      </div>

      {/* Payable */}
      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <span className="text-sm text-muted-foreground font-medium truncate">
            Payable
          </span>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400 leading-tight">
          {fmt(toGive)}
        </p>
        <p className="text-sm text-muted-foreground mt-1 leading-tight">
          {payableParts.length > 0 ? payableParts.join(", ") : "—"}
        </p>
      </div>

      {/* Net */}
      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Scale
            className={`w-4 h-4 shrink-0 ${netBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          />
          <span className="text-sm text-muted-foreground font-medium truncate">
            Net
          </span>
        </div>
        <p
          className={`text-2xl sm:text-3xl font-bold leading-tight ${netBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
        >
          {netBalance >= 0 ? "+" : ""}
          {fmt(netBalance)}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {totalPendingAll} active
        </p>
      </div>
    </div>
  );
};
