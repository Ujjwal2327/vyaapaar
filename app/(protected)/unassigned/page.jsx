"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePeople } from "@/hooks/usePeople";
import { useTransactions, NO_CONTACT } from "@/hooks/useTransactions";
import { TransactionSummary } from "@/components/transactions/TransactionSummary";
import { TransactionList } from "@/components/transactions/TransactionList";
import { AddTransactionModal } from "@/components/transactions/modals/AddTransactionModal";
import { TransactionDetailModal } from "@/components/transactions/modals/TransactionDetailModal";
import { AddPaymentModal } from "@/components/transactions/modals/AddPaymentModal";
import { SettleTransactionsModal } from "@/components/transactions/modals/SettleTransactionsModal";
import { AssignContactModal } from "@/components/transactions/modals/AssignContactModal";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, ArrowLeftRight, UserPlus, Zap } from "lucide-react";
import Logo from "@/components/Logo";
import Navigation from "@/components/Navigation";
import SettingsModal from "@/components/SettingsModal";
import Loader from "@/components/Loader";
import { toast } from "sonner";

const FILTERS_KEY = `tx_list_filters_${NO_CONTACT}`;

const DEFAULT_STATUS_FILTERS = new Set(["pending", "complete", "overpaid"]);
const DEFAULT_KIND_FILTER = "all";
const DEFAULT_ROLE_FILTER = "primary";

const loadFiltersFromStorage = () => {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      kindFilter: parsed.kindFilter ?? DEFAULT_KIND_FILTER,
      statusFilters: new Set(
        Array.isArray(parsed.statusFilters)
          ? parsed.statusFilters
          : ["pending", "complete", "overpaid"],
      ),
      roleFilter: parsed.roleFilter ?? DEFAULT_ROLE_FILTER,
    };
  } catch {
    return null;
  }
};

const saveFiltersToStorage = (kindFilter, statusFilters, roleFilter) => {
  try {
    localStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({
        kindFilter,
        statusFilters: Array.from(statusFilters),
        roleFilter,
      }),
    );
  } catch {
    // ignore storage errors
  }
};

const getErrorMessage = (error) => {
  if (!error) return "An error occurred";
  if (error.message === "NOT_AUTHENTICATED")
    return "You must be logged in to save changes";
  return "Failed to save changes. Please try again";
};

export default function UnassignedPage() {
  const router = useRouter();

  const { peopleData, isHydrated, isDataLoading } = usePeople();
  const {
    transactions,
    isLoading: txLoading,
    summary,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addPayment,
    settleTransactions,
    computeSettlementPreview,
    assignContact,
    assignContactBulk,
    unassignContact,
    dropFromLocalState,
  } = useTransactions(NO_CONTACT);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState(null);

  const selectedTx = useMemo(
    () =>
      selectedTxId
        ? (transactions.find((t) => t.id === selectedTxId) ?? null)
        : null,
    [selectedTxId, transactions],
  );

  const [kindFilter, setKindFilterRaw] = useState(() => {
    const saved = loadFiltersFromStorage();
    return saved?.kindFilter ?? DEFAULT_KIND_FILTER;
  });
  const [statusFilters, setStatusFiltersRaw] = useState(() => {
    const saved = loadFiltersFromStorage();
    return saved?.statusFilters ?? DEFAULT_STATUS_FILTERS;
  });
  const [roleFilter, setRoleFilterRaw] = useState(() => {
    const saved = loadFiltersFromStorage();
    return saved?.roleFilter ?? DEFAULT_ROLE_FILTER;
  });

  const kindFilterRef = useRef(kindFilter);
  const statusFiltersRef = useRef(statusFilters);
  const roleFilterRef = useRef(roleFilter);

  useEffect(() => {
    kindFilterRef.current = kindFilter;
  }, [kindFilter]);
  useEffect(() => {
    statusFiltersRef.current = statusFilters;
  }, [statusFilters]);
  useEffect(() => {
    roleFilterRef.current = roleFilter;
  }, [roleFilter]);

  const setKindFilter = useCallback((value) => {
    setKindFilterRaw(value);
    saveFiltersToStorage(
      value,
      statusFiltersRef.current,
      roleFilterRef.current,
    );
  }, []);

  const setStatusFilters = useCallback((updater) => {
    setStatusFiltersRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveFiltersToStorage(kindFilterRef.current, next, roleFilterRef.current);
      return next;
    });
  }, []);

  const setRoleFilter = useCallback((value) => {
    setRoleFilterRaw(value);
    saveFiltersToStorage(
      kindFilterRef.current,
      statusFiltersRef.current,
      value,
    );
  }, []);

  // Unassigned transactions are always "primary" (no contact owns them, so
  // there's no concept of a "linked/referenced" view here) — but the filter
  // plumbing is shared with the contact page's TransactionList, so we keep
  // the same shape rather than special-casing it away.
  //
  // A transaction that's just been assigned a contact (via the detail
  // modal's "Attach contact"/"Change") is kept in local state so the open
  // modal can keep showing it — including a "Change" option — but it
  // should disappear from the list itself right away, same as the summary.
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (tx.contactId) return false;
      if (roleFilter === "linked") return false;
      const matchKind = kindFilter === "all" || tx.kind === kindFilter;
      const matchStatus = statusFilters.has(tx.status);
      return matchKind && matchStatus;
    });
  }, [transactions, kindFilter, statusFilters, roleFilter]);

  const isPaymentInFlight = useRef(false);

  if (!isHydrated || isDataLoading || txLoading)
    return <Loader content="Loading unassigned transactions..." />;

  const handleAddTransaction = async (formData) => {
    const loadingToast = toast.loading("Adding transaction...");
    try {
      await addTransaction(formData);
      toast.success("Transaction added", { id: loadingToast });
      setShowAddModal(false);
    } catch (e) {
      toast.error(getErrorMessage(e), { id: loadingToast });
    }
  };

  const handleUpdateTransaction = async (txId, updates) => {
    const loadingToast = toast.loading("Updating transaction...");
    try {
      await updateTransaction(txId, updates);
      toast.success("Transaction updated", { id: loadingToast });
    } catch (e) {
      toast.error(getErrorMessage(e), { id: loadingToast });
    }
  };

  const handleDeleteTransaction = async (txId) => {
    toast.warning("Delete this transaction?", {
      description:
        "It will be soft-deleted and any linked settlements will be reversed.",
      action: {
        label: "Delete",
        onClick: async () => {
          const loadingToast = toast.loading("Deleting...");
          try {
            await deleteTransaction(txId);
            toast.success("Transaction deleted", { id: loadingToast });
            setShowDetailModal(false);
            setSelectedTxId(null);
          } catch (e) {
            toast.error(getErrorMessage(e), { id: loadingToast });
          }
        },
      },
      duration: 5000,
    });
  };

  const handleAddPayment = async (payment) => {
    if (!selectedTx) return;
    if (isPaymentInFlight.current) return;
    isPaymentInFlight.current = true;
    const loadingToast = toast.loading("Recording payment...");
    try {
      await addPayment(selectedTx.id, payment);
      toast.success("Payment recorded", { id: loadingToast });
      setShowPaymentModal(false);
    } catch (e) {
      toast.error(getErrorMessage(e), { id: loadingToast });
    } finally {
      isPaymentInFlight.current = false;
    }
  };

  const handleSettle = async (txIds) => {
    const loadingToast = toast.loading("Settling transactions...");
    try {
      const result = await settleTransactions(txIds);
      toast.success("Transactions settled successfully", { id: loadingToast });
      return result;
    } catch (e) {
      toast.error(getErrorMessage(e), { id: loadingToast });
      throw e;
    }
  };

  // Single-transaction assign, called from TransactionDetailModal.
  // Deliberately does NOT close the modal — the transaction stays visible
  // (now showing the assigned contact, with a "Change" option) until the
  // user closes the modal themselves. It's removed from the Unassigned
  // list at that point, via the onOpenChange handler below.
  const handleAssignContact = async (txId, targetContactId, opts) => {
    const loadingToast = toast.loading("Assigning contact...");
    try {
      await assignContact(txId, targetContactId, opts);
      toast.success("Contact assigned", { id: loadingToast });
    } catch (e) {
      toast.error(getErrorMessage(e), { id: loadingToast });
    }
  };

  // Reverts a transaction back to no-contact, called from TransactionDetailModal.
  const handleUnassignContact = async (txId) => {
    const loadingToast = toast.loading("Removing contact...");
    try {
      await unassignContact(txId);
      toast.success("Contact removed", { id: loadingToast });
    } catch (e) {
      toast.error(getErrorMessage(e), { id: loadingToast });
    }
  };

  // Bulk assign, called from AssignContactModal
  const handleAssignContactBulk = async (txIds, targetContactId) => {
    const loadingToast = toast.loading("Assigning contact...");
    try {
      const result = await assignContactBulk(txIds, targetContactId);
      if (result.skippedCount > 0) {
        toast.warning(
          `Assigned ${result.assignedCount}, skipped ${result.skippedCount} (already had a contact)`,
          { id: loadingToast },
        );
      } else {
        toast.success(
          `Assigned ${result.assignedCount} transaction${result.assignedCount !== 1 ? "s" : ""}`,
          {
            id: loadingToast,
          },
        );
      }
    } catch (e) {
      toast.error(getErrorMessage(e), { id: loadingToast });
      throw e;
    }
  };

  const activeTxs = transactions.filter((t) => t.status !== "deleted");
  const pendingTxs = activeTxs.filter(
    (t) =>
      t.status === "pending" && (t.totalAmount ?? 0) - (t.paidAmount ?? 0) > 0,
  );
  const overpaidTxs = activeTxs.filter((t) => t.status === "overpaid");

  const canAutoSettle =
    (pendingTxs.some((t) => t.type === "out") ||
      overpaidTxs.some((t) => t.type === "in")) &&
    (pendingTxs.some((t) => t.type === "in") ||
      overpaidTxs.some((t) => t.type === "out"));

  const unassignedCount = activeTxs.filter((t) => !t.contactId).length;

  return (
    <main className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b">
        <div className="max-w-4xl mx-auto p-2">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-4">
              <Logo titleClassName="hidden sm:inline" />
              <Navigation />
            </div>
            <div className="flex items-center gap-2">
              <SettingsModal />
            </div>
          </div>

          {/* Page title bar — replaces the contact info bar */}
          <div className="flex items-center gap-3 py-2 border-t">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/contacts")}
              className="shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-base truncate">Unassigned</h1>
              <p className="text-sm text-muted-foreground">
                Walk-in transactions without a contact
              </p>
            </div>

            <Button
              onClick={() => setShowAddModal(true)}
              size="sm"
              className="shrink-0"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
            {canAutoSettle && (
              <Button
                onClick={() => setShowSettleModal(true)}
                size="sm"
                variant="outline"
                className="shrink-0 gap-1"
                title="Auto-settle pending transactions"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span className="hidden sm:inline">Settle</span>
              </Button>
            )}
            {unassignedCount > 0 && (
              <Button
                onClick={() => setShowAssignModal(true)}
                size="sm"
                variant="outline"
                className="shrink-0 gap-1"
                title="Attach a contact to one or more unassigned transactions"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Assign</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-2 space-y-4">
        {/* Summary Cards */}
        <TransactionSummary summary={summary} />

        {/* Filters + List */}
        <TransactionList
          transactions={filteredTransactions}
          allTransactions={transactions}
          kindFilter={kindFilter}
          setKindFilter={setKindFilter}
          statusFilters={statusFilters}
          setStatusFilters={setStatusFilters}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          onSelectTransaction={(tx) => {
            setSelectedTxId(tx.id);
            setShowDetailModal(true);
          }}
          peopleData={peopleData}
        />
      </div>

      {/* Modals */}
      <AddTransactionModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        contact={undefined}
        onAdd={handleAddTransaction}
        peopleData={peopleData}
        currentContactId={undefined}
      />

      <TransactionDetailModal
        open={showDetailModal}
        onOpenChange={(v) => {
          setShowDetailModal(v);
          if (!v) {
            // If the transaction we were viewing got assigned a contact
            // during this session, it was kept in local state on purpose
            // (so "Change" stayed available) — now that the modal is
            // closing, it's safe to drop it from the Unassigned pool.
            if (selectedTx?.contactId) {
              dropFromLocalState(selectedTx.id);
            }
            setSelectedTxId(null);
          }
        }}
        transaction={selectedTx}
        contact={undefined}
        allTransactions={transactions}
        onNavigateToTransaction={(tx) => setSelectedTxId(tx.id)}
        onUpdate={handleUpdateTransaction}
        onDelete={handleDeleteTransaction}
        onAddPayment={() => setShowPaymentModal(true)}
        onAssignContact={handleAssignContact}
        onUnassignContact={handleUnassignContact}
        peopleData={peopleData}
      />

      <AddPaymentModal
        open={showPaymentModal}
        onOpenChange={(v) => {
          setShowPaymentModal(v);
          if (!v) {
            setShowDetailModal(true);
          }
        }}
        transaction={selectedTx}
        onSave={handleAddPayment}
      />

      <SettleTransactionsModal
        open={showSettleModal}
        onOpenChange={setShowSettleModal}
        transactions={transactions}
        computeSettlementPreview={computeSettlementPreview}
        onSettle={handleSettle}
      />

      <AssignContactModal
        open={showAssignModal}
        onOpenChange={setShowAssignModal}
        transactions={transactions}
        initialSelectedIds={null}
        onAssign={handleAssignContactBulk}
        peopleData={peopleData}
      />
    </main>
  );
}
