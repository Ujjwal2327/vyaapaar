"use client";

import { useState, useRef, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, ChevronDown, Check } from "lucide-react";
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

  // Close on outside click
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
        if (next.size === 1) return prev; // keep at least one
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  // Build trigger label
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
      {/* Trigger — matches the kind Select trigger visually */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate text-foreground">{triggerLabel}</span>
        <ChevronDown
          className={`ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full mt-1 z-50 w-full min-w-[140px] rounded-md border bg-popover shadow-md overflow-hidden">
          {STATUS_OPTIONS.map(({ value, label, dot }) => {
            const count = counts[value];
            if (value === "deleted" && count === 0) return null;
            const checked = statusFilters.has(value);
            return (
              <button
                key={value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent blur before toggle
                  toggleStatus(value);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-xs hover:bg-accent transition-colors"
              >
                {/* checkbox visual */}
                <span
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors ${checked ? "bg-primary border-primary" : "border-muted-foreground/40"}`}
                >
                  {checked && (
                    <Check className="h-2.5 w-2.5 text-primary-foreground stroke-[3]" />
                  )}
                </span>
                {/* dot */}
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
                {/* label + count */}
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
  onSelectTransaction,
}) => {
  const counts = {
    // Exclude deleted from kind counts so "All types (N)" matches what's
    // visible under the default status filter (active only).
    all: allTransactions.filter((t) => t.status !== "deleted").length,
    item: allTransactions.filter(
      (t) => t.kind === "item" && t.status !== "deleted",
    ).length,
    financial: allTransactions.filter(
      (t) => t.kind === "financial" && t.status !== "deleted",
    ).length,
    pending: allTransactions.filter((t) => t.status === "pending").length,
    complete: allTransactions.filter((t) => t.status === "complete").length,
    overpaid: allTransactions.filter((t) => t.status === "overpaid").length,
    deleted: allTransactions.filter((t) => t.status === "deleted").length,
  };

  const isFiltered =
    kindFilter !== "all" ||
    !statusFilters.has("pending") ||
    !statusFilters.has("complete") ||
    !statusFilters.has("overpaid") ||
    statusFilters.has("deleted");

  return (
    <div className="space-y-3">
      {/* single filter row */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

        {/* Kind */}
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All types ({counts.all})
            </SelectItem>
            <SelectItem value="item" className="text-xs">
              Items ({counts.item})
            </SelectItem>
            <SelectItem value="financial" className="text-xs">
              Financial ({counts.financial})
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Status checklist dropdown */}
        <StatusDropdown
          statusFilters={statusFilters}
          setStatusFilters={setStatusFilters}
          counts={counts}
        />
      </div>

      {/* list */}
      {transactions.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-muted-foreground text-sm">No transactions found</p>
          {isFiltered && (
            <p className="text-xs text-muted-foreground mt-1">
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
              onClick={() => onSelectTransaction(tx)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
