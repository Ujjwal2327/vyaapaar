"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";
import { TransactionCard } from "./TransactionCard";

export const TransactionList = ({
  transactions,
  allTransactions,
  kindFilter,
  setKindFilter,
  statusFilter,
  setStatusFilter,
  onSelectTransaction,
}) => {
  // Active = everything that isn't deleted (used for kind counts and the
  // "active" status bucket so deleted transactions don't inflate counts).
  const activeTxs = allTransactions.filter((t) => t.status !== "deleted");

  const counts = {
    active: activeTxs.length,
    item: activeTxs.filter((t) => t.kind === "item").length,
    financial: activeTxs.filter((t) => t.kind === "financial").length,
    pending: activeTxs.filter((t) => t.status === "pending").length,
    complete: activeTxs.filter((t) => t.status === "complete").length,
    overpaid: activeTxs.filter((t) => t.status === "overpaid").length,
    deleted: allTransactions.filter((t) => t.status === "deleted").length,
  };

  const isShowingDeleted = statusFilter === "deleted";

  return (
    <div className="space-y-3">
      {/* filter row */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All types ({isShowingDeleted ? counts.deleted : counts.active})
            </SelectItem>
            <SelectItem value="item" className="text-xs">
              Items ({counts.item})
            </SelectItem>
            <SelectItem value="financial" className="text-xs">
              Financial ({counts.financial})
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active" className="text-xs">
              Active ({counts.active})
            </SelectItem>
            <SelectItem value="pending" className="text-xs">
              Pending ({counts.pending})
            </SelectItem>
            <SelectItem value="complete" className="text-xs">
              Complete ({counts.complete})
            </SelectItem>
            {counts.overpaid > 0 && (
              <SelectItem value="overpaid" className="text-xs">
                Overpaid ({counts.overpaid})
              </SelectItem>
            )}
            {counts.deleted > 0 && (
              <SelectItem value="deleted" className="text-xs">
                Deleted ({counts.deleted})
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* list */}
      {transactions.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-muted-foreground text-sm">No transactions found</p>
          {(kindFilter !== "all" || statusFilter !== "active") && (
            <p className="text-xs text-muted-foreground mt-1">
              Try changing the filters above
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
