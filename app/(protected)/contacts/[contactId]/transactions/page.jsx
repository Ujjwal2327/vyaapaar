"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePeople } from "@/hooks/usePeople";
import { useTransactions } from "@/hooks/useTransactions";
import { TransactionSummary } from "@/components/transactions/TransactionSummary";
import { TransactionList } from "@/components/transactions/TransactionList";
import { AddTransactionModal } from "@/components/transactions/modals/AddTransactionModal";
import { TransactionDetailModal } from "@/components/transactions/modals/TransactionDetailModal";
import { AddPaymentModal } from "@/components/transactions/modals/AddPaymentModal";
import { SettleTransactionsModal } from "@/components/transactions/modals/SettleTransactionsModal";
import { NetSettleModal } from "@/components/transactions/modals/NetSettleModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Phone,
  MapPin,
  ArrowLeftRight,
  Zap,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Logo from "@/components/Logo";
import Navigation from "@/components/Navigation";
import SettingsModal from "@/components/SettingsModal";
import Loader from "@/components/Loader";
import { toast } from "sonner";

const CATEGORY_COLORS = {
  customer:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  supplier: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  helper: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

// FIX #7: Key filters per-contact so changing filter state on one contact
// does not bleed through to other contacts. The old single key meant that
// setting "show deleted" on contact A would leave contact B also filtered to
// deleted-only on the next visit.
const filtersStorageKey = (contactId) => `tx_list_filters_${contactId}`;

// Default: show all active statuses (exclude deleted)
const DEFAULT_STATUS_FILTERS = new Set(["pending", "complete", "overpaid"]);
const DEFAULT_KIND_FILTER = "all";

const loadFiltersFromStorage = (contactId) => {
  try {
    const raw = localStorage.getItem(filtersStorageKey(contactId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      kindFilter: parsed.kindFilter ?? DEFAULT_KIND_FILTER,
      statusFilters: new Set(
        Array.isArray(parsed.statusFilters)
          ? parsed.statusFilters
          : ["pending", "complete", "overpaid"],
      ),
    };
  } catch {
    return null;
  }
};

const saveFiltersToStorage = (contactId, kindFilter, statusFilters) => {
  try {
    localStorage.setItem(
      filtersStorageKey(contactId),
      JSON.stringify({
        kindFilter,
        statusFilters: Array.from(statusFilters),
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

export default function TransactionsPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.contactId;

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
    netSettle,
  } = useTransactions(contactId);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showNetSettleModal, setShowNetSettleModal] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState(null);

  // Derive the live transaction object from the hook's transactions array so
  // that any updates (settle, payment, edit) are reflected immediately without
  // a manual page refresh.
  const selectedTx = useMemo(
    () =>
      selectedTxId
        ? (transactions.find((t) => t.id === selectedTxId) ?? null)
        : null,
    [selectedTxId, transactions],
  );

  // Load filter state from localStorage on first render, fall back to defaults.
  const [kindFilter, setKindFilterRaw] = useState(() => {
    const saved = loadFiltersFromStorage(contactId);
    return saved?.kindFilter ?? DEFAULT_KIND_FILTER;
  });
  const [statusFilters, setStatusFiltersRaw] = useState(() => {
    const saved = loadFiltersFromStorage(contactId);
    return saved?.statusFilters ?? DEFAULT_STATUS_FILTERS;
  });

  // Keep refs in sync so the setters can read the sibling value without
  // scheduling a spurious nested setState.
  const kindFilterRef = useRef(kindFilter);
  const statusFiltersRef = useRef(statusFilters);
  useEffect(() => {
    kindFilterRef.current = kindFilter;
  }, [kindFilter]);
  useEffect(() => {
    statusFiltersRef.current = statusFilters;
  }, [statusFilters]);

  // Wrap setters to persist to localStorage on every change.
  const setKindFilter = useCallback(
    (value) => {
      setKindFilterRaw(value);
      saveFiltersToStorage(contactId, value, statusFiltersRef.current);
    },
    [contactId],
  );

  const setStatusFilters = useCallback(
    (updater) => {
      setStatusFiltersRaw((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        saveFiltersToStorage(contactId, kindFilterRef.current, next);
        return next;
      });
    },
    [contactId],
  );

  const contact = useMemo(
    () => peopleData.find((p) => p.id === contactId),
    [peopleData, contactId],
  );

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchKind = kindFilter === "all" || tx.kind === kindFilter;
      const matchStatus = statusFilters.has(tx.status);
      return matchKind && matchStatus;
    });
  }, [transactions, kindFilter, statusFilters]);

  // Must be declared here (before any early returns) so the hook call order
  // is stable across every render. Moving it after an early return caused
  // "rendered more hooks than during the previous render" errors.
  const isPaymentInFlight = useRef(false);

  if (!isHydrated || isDataLoading || txLoading)
    return <Loader content="Loading transactions..." />;

  if (!contact) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Contact not found</p>
          <Button onClick={() => router.push("/contacts")}>
            Back to Contacts
          </Button>
        </div>
      </div>
    );
  }

  const getInitials = (name) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const categoryColor =
    CATEGORY_COLORS[contact.category] ?? CATEGORY_COLORS.other;
  const phones = contact.phones ?? (contact.phone ? [contact.phone] : []);
  const primaryPhone = phones.find((p) => p && p.trim()) ?? null;

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
      // Close only the payment modal. Its onOpenChange will re-open the detail
      // modal so the user returns to the updated transaction view. Do NOT call
      // setShowDetailModal(false) here — that would race with onOpenChange's
      // setShowDetailModal(true) and the detail modal would never re-open.
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
      // Re-throw so SettleTransactionsModal.handleConfirm knows the operation
      // failed and keeps the modal open for the user to retry.
      throw e;
    }
  };

  const handleNetSettle = async ({ note, method }) => {
    const loadingToast = toast.loading("Settling transactions...");
    try {
      await netSettle({ note, method });
      toast.success("All transactions settled successfully", {
        id: loadingToast,
      });
    } catch (e) {
      toast.error(getErrorMessage(e), { id: loadingToast });
      throw e;
    }
  };

  // Whether auto-settle is possible: need at least one pending sale + one pending purchase.
  // Deleted transactions are excluded. Pending transactions must have remaining > 0
  // (a stuck zero-total tx has status "pending" but nothing to offset).
  const activeTxs = transactions.filter((t) => t.status !== "deleted");
  const pendingTxs = activeTxs.filter(
    (t) =>
      t.status === "pending" && (t.totalAmount ?? 0) - (t.paidAmount ?? 0) > 0,
  );
  const overpaidTxs = activeTxs.filter((t) => t.status === "overpaid");
  // Show Settle button when there's at least one receivable source AND one payable source:
  //   receivable: pending sale OR overpaid purchase (supplier owes us back)
  //   payable:    pending purchase OR overpaid sale (we owe customer back)
  const canAutoSettle =
    (pendingTxs.some((t) => t.type === "out") ||
      overpaidTxs.some((t) => t.type === "in")) &&
    (pendingTxs.some((t) => t.type === "in") ||
      overpaidTxs.some((t) => t.type === "out"));

  // Show Net Settle button when there IS a non-zero net balance but canAutoSettle
  // is false — meaning all pending/overpaid txs are on one side only. One click
  // records the net cash payment and settles everything automatically.
  const netBalance = summary.toReceive - summary.toGive;
  const hasAnyActive = pendingTxs.length > 0 || overpaidTxs.length > 0;
  const canNetSettle =
    !canAutoSettle && hasAnyActive && Math.abs(netBalance) > 0.01;

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

          {/* Contact Info Bar */}
          <div className="flex items-center gap-3 py-2 border-t">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/contacts")}
              className="shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            <Avatar className="w-10 h-10 shrink-0">
              <AvatarFallback className="bg-primary/10 text-sm">
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-semibold text-base truncate">
                  {contact.name}
                </h1>
                <Badge className={`${categoryColor} border-0 text-xs`}>
                  {contact.category}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {primaryPhone && (
                  <a
                    href={`tel:${primaryPhone}`}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    <Phone className="w-3 h-3" />
                    {primaryPhone}
                  </a>
                )}
                {contact.address && (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {contact.address}
                  </span>
                )}
              </div>
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
            {canNetSettle && (
              <Button
                onClick={() => setShowNetSettleModal(true)}
                size="sm"
                variant="outline"
                className="shrink-0 gap-1 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30"
                title="Record net payment and settle all transactions"
              >
                <Zap className="w-4 h-4" />
                <span className="hidden sm:inline">Net Settle</span>
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
          onSelectTransaction={(tx) => {
            setSelectedTxId(tx.id);
            setShowDetailModal(true);
          }}
        />
      </div>

      {/* Modals */}
      <AddTransactionModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        contact={contact}
        onAdd={handleAddTransaction}
      />

      <TransactionDetailModal
        open={showDetailModal}
        onOpenChange={(v) => {
          setShowDetailModal(v);
          if (!v) setSelectedTxId(null);
        }}
        transaction={selectedTx}
        contact={contact}
        allTransactions={transactions}
        onNavigateToTransaction={(tx) => setSelectedTxId(tx.id)}
        onUpdate={handleUpdateTransaction}
        onDelete={handleDeleteTransaction}
        onAddPayment={() => setShowPaymentModal(true)}
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

      <NetSettleModal
        open={showNetSettleModal}
        onOpenChange={setShowNetSettleModal}
        transactions={transactions}
        summary={summary}
        onNetSettle={handleNetSettle}
      />
    </main>
  );
}
