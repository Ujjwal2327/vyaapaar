"use client";

/**
 * components/analytics/SummaryCards.jsx
 *
 * Deliberately mirrors TransactionSummary.jsx's three-card layout and
 * color language (green receivable, red payable, sign-dependent net) —
 * this is the same numbers computed the same way (see
 * computeCurrentSummary / categorizeBalance in analyticsUtils.js), just
 * totalled across every contact instead of one.
 */

import { TrendingUp, TrendingDown, Scale } from "lucide-react";
import { fmtCurrency } from "@/lib/utils/analyticsUtils";

export const SummaryCards = ({ summary }) => {
  const { toReceive, toGive, net } = summary;

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-sm text-muted-foreground font-medium truncate">
            Receivable
          </span>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400 leading-tight">
          {fmtCurrency(toReceive)}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <span className="text-sm text-muted-foreground font-medium truncate">
            Payable
          </span>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400 leading-tight">
          {fmtCurrency(toGive)}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Scale
            className={`w-4 h-4 shrink-0 ${
              net >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          />
          <span className="text-sm text-muted-foreground font-medium truncate">
            Net
          </span>
        </div>
        <p
          className={`text-xl sm:text-2xl font-bold leading-tight ${
            net >= 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {net >= 0 ? "+" : ""}
          {fmtCurrency(net)}
        </p>
      </div>
    </div>
  );
};
