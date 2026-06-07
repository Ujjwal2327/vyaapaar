import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

export const useTransactions = (contactId) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasFetched = useRef(false);

  const localKey = `transactions_${contactId}`;

  const loadFromLocal = useCallback(() => {
    try {
      const raw = localStorage.getItem(localKey);
      if (raw) setTransactions(JSON.parse(raw));
    } catch {
      setTransactions([]);
    }
  }, [localKey]);

  const saveToLocal = useCallback(
    (data) => {
      localStorage.setItem(localKey, JSON.stringify(data));
    },
    [localKey],
  );

  useEffect(() => {
    if (!contactId) return;
    hasFetched.current = false;
  }, [contactId]);

  useEffect(() => {
    if (!contactId) return;
    if (hasFetched.current) return;

    const load = async () => {
      setIsLoading(true);
      hasFetched.current = true;

      if (!user) {
        loadFromLocal();
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: err } = await supabase
          .from("transactions")
          .select("*")
          .eq("contact_id", contactId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (err) throw err;

        const rows = (data ?? []).map(rowToTransaction);
        setTransactions(rows);
        saveToLocal(rows);
      } catch (e) {
        console.error("Transactions load error:", e);
        loadFromLocal();
        setError(e);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [contactId, user, loadFromLocal, saveToLocal]);

  const rowToTransaction = (row) => ({
    id: row.id,
    type: row.type,
    kind: row.kind,
    contactId: row.contact_id,
    itemsList: row.items_list ?? [],
    additionalAmounts: row.additional_amounts ?? [],
    totalAmount: row.total_amount ?? 0,
    paidAmount: row.paid_amount ?? 0,
    paidAmountHistory: row.paid_amount_history ?? [],
    itemListHistory: row.item_list_history ?? [],
    note: row.note ?? "",
    status: row.status ?? "pending",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const transactionToRow = (tx) => ({
    id: tx.id,
    user_id: user.id,
    contact_id: tx.contactId ?? contactId,
    type: tx.type,
    kind: tx.kind,
    items_list: tx.itemsList ?? [],
    additional_amounts: tx.additionalAmounts ?? [],
    total_amount: tx.totalAmount ?? 0,
    paid_amount: tx.paidAmount ?? 0,
    paid_amount_history: tx.paidAmountHistory ?? [],
    item_list_history: tx.itemListHistory ?? [],
    note: tx.note ?? "",
    status: tx.status ?? "pending",
  });

  const addTransaction = async (newTx) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    const tx = {
      ...newTx,
      id: crypto.randomUUID(),
      contactId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const row = transactionToRow(tx);
    const { error: err } = await supabase.from("transactions").insert([row]);
    if (err) throw err;

    const updated = [tx, ...transactions];
    setTransactions(updated);
    saveToLocal(updated);
    return tx;
  };

  const updateTransaction = async (txId, updates) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    const existing = transactions.find((t) => t.id === txId);
    if (!existing) throw new Error("Transaction not found");

    const updated = {
      ...existing,
      ...updates,
      id: txId,
      updatedAt: new Date().toISOString(),
    };

    const row = transactionToRow(updated);
    const { error: err } = await supabase
      .from("transactions")
      .upsert([row], { onConflict: "id" });

    if (err) throw err;

    const newList = transactions.map((t) => (t.id === txId ? updated : t));
    setTransactions(newList);
    saveToLocal(newList);
    return updated;
  };

  const deleteTransaction = async (txId) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    const { error: err } = await supabase
      .from("transactions")
      .delete()
      .eq("id", txId)
      .eq("user_id", user.id);

    if (err) throw err;

    const newList = transactions.filter((t) => t.id !== txId);
    setTransactions(newList);
    saveToLocal(newList);
  };

  const addPayment = async (txId, payment) => {
    const existing = transactions.find((t) => t.id === txId);
    if (!existing) throw new Error("Transaction not found");

    const newPaid = (existing.paidAmount ?? 0) + payment.amount;
    // complete only when fully paid; overpaid also → complete
    const newStatus = newPaid >= existing.totalAmount ? "complete" : "pending";

    const updates = {
      paidAmount: newPaid,
      paidAmountHistory: [
        ...existing.paidAmountHistory,
        {
          amount: payment.amount,
          note: payment.note ?? "",
          method: payment.method ?? "cash",
          date: new Date().toISOString(),
        },
      ],
      status: newStatus,
    };

    return updateTransaction(txId, updates);
  };

  // ── Summary ───────────────────────────────────────────────────────────────
  // Include ALL transactions (pending + complete with advance) in net balance.
  // "toReceive" = money still owed TO us (type=out, remaining > 0, pending)
  // "toGive"    = money we still owe (type=in, remaining > 0, pending)
  // Advances (overpaid, remaining < 0) flip the direction in net balance.
  const summary = transactions.reduce(
    (acc, tx) => {
      const remaining = (tx.totalAmount ?? 0) - (tx.paidAmount ?? 0);

      // Count pending transactions for display
      if (tx.status === "pending") {
        acc.totalPending += 1;
        if (tx.type === "out") acc.pendingOut += 1;
        else acc.pendingIn += 1;
      }

      // Net balance contributions — include advances from complete transactions too
      if (tx.status === "pending" || remaining < 0) {
        if (tx.type === "out") {
          // remaining > 0: they still owe us → increases toReceive
          // remaining < 0: we overpaid / advance → reduces toReceive (or adds to toGive)
          acc.toReceive += remaining;
        } else {
          // remaining > 0: we still owe them → increases toGive
          // remaining < 0: they overpaid us / advance → reduces toGive
          acc.toGive += remaining;
        }
      }

      return acc;
    },
    { toReceive: 0, toGive: 0, pendingOut: 0, pendingIn: 0, totalPending: 0 },
  );

  return {
    transactions,
    isLoading,
    error,
    summary,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addPayment,
  };
};
