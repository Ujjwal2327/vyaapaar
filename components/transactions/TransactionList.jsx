"use client";

import { useState, useRef, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, ChevronDown, Check, Link2, User } from "lucide-react";
import { TransactionCard } from "./TransactionCard";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", dot: "bg-amber-500" },
  { value: "complete", label: "Complete", dot: "bg-green-500" },
  { value: "overpaid", label: "Overpaid", dot: "bg-blue-500" },
  { value: "deleted", label: "Deleted", dot: "bg-red-400" },
];

const StatusDropdown = ({ statusFilters, setStatusFilters, counts }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggleStatus = (value) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        if (next.size === 1) return prev;
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const activeOptions = STATUS_OPTIONS.filter(
    (o) =>
      statusFilters.has(o.value) &&
      (o.value !== "deleted" || counts.deleted > 0),
  );
  const allNonDeletedActive =
    statusFilters.has("pending") &&
    statusFilters.has("complete") &&
    statusFilters.has("overpaid") &&
    !statusFilters.has("deleted");

  let triggerLabel;
  if (allNonDeletedActive) {
    triggerLabel = "Active";
  } else if (activeOptions.length === 1) {
    triggerLabel = activeOptions[0].label;
  } else if (activeOptions.length === 0) {
    triggerLabel = "None";
  } else {
    triggerLabel = `${activeOptions.length} statuses`;
  }

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span className="truncate text-foreground">{triggerLabel}</span>
        <ChevronDown
          className={`ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full mt-1 z-50 w-full min-w-[9rem] rounded-md border bg-popover shadow-md overflow-hidden">
          {STATUS_OPTIONS.map(({ value, label, dot }) => {
            const count = counts[value];
            if (value === "deleted" && count === 0) return null;
            const checked = statusFilters.has(value);
            return (
              <button
                key={value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleStatus(value);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-accent transition-colors"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors ${checked ? "bg-primary border-primary" : "border-muted-foreground/40"}`}
                >
                  {checked && (
                    <Check className="h-3 w-3 text-primary-foreground stroke-[3]" />
                  )}
                </span>
                <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
                <span className="flex-1 text-left font-medium">{label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const TransactionList = ({
  transactions,
  allTransactions,
  kindFilter,
  setKindFilter,
  statusFilters,
  setStatusFilters,
  roleFilter,
  setRoleFilter,
  onSelectTransaction,
  peopleData = [],
}) => {
  // Counts based on role filter for kind/status dropdowns
  const baseTxs =
    roleFilter === "primary"
      ? allTransactions.filter((t) => t._role !== "linked")
      : roleFilter === "linked"
        ? allTransactions.filter((t) => t._role === "linked")
        : allTransactions;

  const counts = {
    all: baseTxs.filter((t) => t.status !== "deleted").length,
    item: baseTxs.filter((t) => t.kind === "item" && t.status !== "deleted")
      .length,
    financial: baseTxs.filter(
      (t) => t.kind === "financial" && t.status !== "deleted",
    ).length,
    pending: baseTxs.filter((t) => t.status === "pending").length,
    complete: baseTxs.filter((t) => t.status === "complete").length,
    overpaid: baseTxs.filter((t) => t.status === "overpaid").length,
    deleted: baseTxs.filter((t) => t.status === "deleted").length,
  };

  // Count linked transactions for the role filter tabs
  const primaryCount = allTransactions.filter(
    (t) => t._role !== "linked" && t.status !== "deleted",
  ).length;
  const linkedCount = allTransactions.filter(
    (t) => t._role === "linked" && t.status !== "deleted",
  ).length;

  const isFiltered =
    kindFilter !== "all" ||
    !statusFilters.has("pending") ||
    !statusFilters.has("complete") ||
    !statusFilters.has("overpaid") ||
    statusFilters.has("deleted") ||
    roleFilter !== "primary";

  return (
    <div className="space-y-3">
      {/* Single filter row — role toggle merged in when linked txs exist */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />

        {/* Role toggle — only shown when linked transactions exist */}
        {linkedCount > 0 && (
          <div className="flex rounded-md border border-input overflow-hidden shrink-0">
            {[
              { id: "primary", icon: User, title: `Mine (${primaryCount})` },
              {
                id: "linked",
                icon: Link2,
                title: `Referenced (${linkedCount})`,
              },
              {
                id: "all",
                icon: null,
                title: `All (${primaryCount + linkedCount})`,
              },
            ].map(({ id, icon: Icon, title }) => (
              <button
                key={id}
                type="button"
                onClick={() => setRoleFilter(id)}
                title={title}
                className={`h-10 px-2.5 flex items-center justify-center text-sm transition-colors border-r last:border-r-0 border-input ${
                  roleFilter === id
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {Icon ? (
                  <Icon className="w-3.5 h-3.5" />
                ) : (
                  <span className="text-xs font-medium leading-none">All</span>
                )}
              </button>
            ))}
          </div>
        )}

        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="h-10 text-sm flex-1 min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-sm">
              All types ({counts.all})
            </SelectItem>
            <SelectItem value="item" className="text-sm">
              Items ({counts.item})
            </SelectItem>
            <SelectItem value="financial" className="text-sm">
              Financial ({counts.financial})
            </SelectItem>
          </SelectContent>
        </Select>

        <StatusDropdown
          statusFilters={statusFilters}
          setStatusFilters={setStatusFilters}
          counts={counts}
        />
      </div>

      {/* Compact referenced notice — only one line, no banner */}
      {roleFilter === "linked" && linkedCount > 0 && (
        <p className="text-sm text-purple-600 dark:text-purple-400 flex items-center gap-1.5 px-0.5">
          <Link2 className="w-3.5 h-3.5 shrink-0" />
          Reference only — summary &amp; settle use primary transactions
        </p>
      )}

      {/* list */}
      {transactions.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-muted-foreground text-base">
            No transactions found
          </p>
          {isFiltered && (
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting the filters above
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {transactions.map((tx) => (
            <TransactionCard
              key={tx.id}
              transaction={tx}
              peopleData={peopleData}
              onClick={() => onSelectTransaction(tx)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
