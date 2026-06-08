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

  // ── settleTransactions ────────────────────────────────────────────────────
  //
  // Settlement priority (oldest first within each tier):
  //   1. Pending vs pending — normal mutual offset
  //   2. Overpaid advance vs pending — use the surplus to clear pending dues
  //
  // Overpaid semantics:
  //   overpaid "out" (sale, remaining < 0): customer gave us extra → we owe
  //     them → their advance can offset a pending "in" (purchase we owe).
  //   overpaid "in" (purchase, remaining < 0): we overpaid supplier → supplier
  //     owes us back → can offset a pending "out" (sale they owe us).
  //
  // When an overpaid tx's advance is consumed, we record a NEGATIVE payment
  // entry ("advance-applied") and reduce paidAmount accordingly, so the
  // advance balance drops to zero. No DB schema changes required.
  //
  const settleTransactions = async (txIds) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    // Pull all selected transactions — both pending AND overpaid complete ones
    const selected = txIds
      .map((id) => transactions.find((t) => t.id === id))
      .filter(Boolean)
      .filter((t) => {
        const rem = (t.totalAmount ?? 0) - (t.paidAmount ?? 0);
        return t.status === "pending" || rem < 0; // pending OR overpaid
      });

    if (selected.length < 2)
      throw new Error("Need at least 2 eligible transactions");

    const settledAt = new Date().toISOString();
    const settlementGroupId = crypto.randomUUID();

    // Sort each pool oldest-first within pending, then oldest-first within overpaid.
    // Pending transactions go before overpaid advances (priority 1 before 2).
    const byDate = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);

    // outPool: sources of "money owed TO us"
    //   - pending out (remaining > 0): sale, customer still owes us
    //   - overpaid in  (remaining < 0): we overpaid supplier → supplier owes us back
    const outPool = [
      ...selected
        .filter((t) => t.type === "out" && t.status === "pending")
        .map((t) => ({
          ...t,
          remaining: (t.totalAmount ?? 0) - (t.paidAmount ?? 0),
          isAdvance: false,
        }))
        .filter((t) => t.remaining > 0)
        .sort(byDate),
      ...selected
        .filter(
          (t) =>
            t.type === "in" && (t.totalAmount ?? 0) - (t.paidAmount ?? 0) < 0,
        )
        .map((t) => ({
          ...t,
          remaining: Math.abs((t.totalAmount ?? 0) - (t.paidAmount ?? 0)),
          isAdvance: true,
        }))
        .sort(byDate),
    ];

    // inPool: sources of "money we owe"
    //   - pending in  (remaining > 0): purchase, we still owe supplier
    //   - overpaid out (remaining < 0): customer overpaid us → we owe customer
    const inPool = [
      ...selected
        .filter((t) => t.type === "in" && t.status === "pending")
        .map((t) => ({
          ...t,
          remaining: (t.totalAmount ?? 0) - (t.paidAmount ?? 0),
          isAdvance: false,
        }))
        .filter((t) => t.remaining > 0)
        .sort(byDate),
      ...selected
        .filter(
          (t) =>
            t.type === "out" && (t.totalAmount ?? 0) - (t.paidAmount ?? 0) < 0,
        )
        .map((t) => ({
          ...t,
          remaining: Math.abs((t.totalAmount ?? 0) - (t.paidAmount ?? 0)),
          isAdvance: true,
        }))
        .sort(byDate),
    ];

    // Map of txId → { amount, partnerIds, isAdvance }
    const settlementMap = {};
    selected.forEach((t) => {
      settlementMap[t.id] = { amount: 0, partnerIds: [] };
    });

    // Greedy offset: pair out entries against in entries
    let oi = 0,
      ii = 0;
    while (oi < outPool.length && ii < inPool.length) {
      const outTx = outPool[oi];
      const inTx = inPool[ii];
      const offset = Math.min(outTx.remaining, inTx.remaining);
      if (offset > 0) {
        settlementMap[outTx.id].amount += offset;
        settlementMap[outTx.id].partnerIds.push(inTx.id);
        settlementMap[inTx.id].amount += offset;
        settlementMap[inTx.id].partnerIds.push(outTx.id);
        outTx.remaining -= offset;
        inTx.remaining -= offset;
      }
      if (outTx.remaining <= 0.001) oi++;
      if (inTx.remaining <= 0.001) ii++;
    }

    // Apply updates for all transactions that had any settlement
    const updatePromises = [];
    for (const tx of selected) {
      const settlement = settlementMap[tx.id];
      if (settlement.amount <= 0) continue;

      const existing = transactions.find((t) => t.id === tx.id);
      const currentRemaining =
        (existing.totalAmount ?? 0) - (existing.paidAmount ?? 0);
      const isAdvanceTx = currentRemaining < 0;

      const partnerNote =
        settlement.partnerIds.length > 0
          ? `Settled against: ${settlement.partnerIds.map((id) => id.slice(0, 8)).join(", ")}`
          : "Mutual settlement";

      let newPaid;
      let historyEntry;

      if (isAdvanceTx) {
        // Consuming an advance: reduce paidAmount to eliminate the surplus
        // e.g. total=1500, paid=2000, advance=500 → apply 500 → paid becomes 1500
        newPaid = (existing.paidAmount ?? 0) - settlement.amount;
        historyEntry = {
          amount: -settlement.amount, // negative = advance consumed
          note: partnerNote,
          method: "advance-applied",
          date: settledAt,
          settlementGroupId,
          partnerIds: settlement.partnerIds,
        };
      } else {
        // Normal pending settlement: increase paidAmount
        newPaid = (existing.paidAmount ?? 0) + settlement.amount;
        historyEntry = {
          amount: settlement.amount,
          note: partnerNote,
          method: "settlement",
          date: settledAt,
          settlementGroupId,
          partnerIds: settlement.partnerIds,
        };
      }

      // Status: complete when fully settled (no advance remaining, no pending balance)
      const newRemaining = (existing.totalAmount ?? 0) - newPaid;
      const newStatus = Math.abs(newRemaining) < 0.001 ? "complete" : "pending";

      const updates = {
        paidAmount: newPaid,
        paidAmountHistory: [...existing.paidAmountHistory, historyEntry],
        status: newStatus,
      };

      updatePromises.push(updateTransaction(tx.id, updates));
    }

    await Promise.all(updatePromises);
    return settlementGroupId;
  };

  // ── computeSettlementPreview ──────────────────────────────────────────────
  // Returns a preview of what would happen if the selected txIds are settled.
  // Mirrors the logic in settleTransactions exactly.
  const computeSettlementPreview = (txIds) => {
    const selected = txIds
      .map((id) => transactions.find((t) => t.id === id))
      .filter(Boolean)
      .filter((t) => {
        const rem = (t.totalAmount ?? 0) - (t.paidAmount ?? 0);
        return t.status === "pending" || rem < 0;
      });

    const byDate = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);

    const outPool = [
      ...selected
        .filter((t) => t.type === "out" && t.status === "pending")
        .map((t) => ({
          ...t,
          remaining: (t.totalAmount ?? 0) - (t.paidAmount ?? 0),
          isAdvance: false,
        }))
        .filter((t) => t.remaining > 0)
        .sort(byDate),
      ...selected
        .filter(
          (t) =>
            t.type === "in" && (t.totalAmount ?? 0) - (t.paidAmount ?? 0) < 0,
        )
        .map((t) => ({
          ...t,
          remaining: Math.abs((t.totalAmount ?? 0) - (t.paidAmount ?? 0)),
          isAdvance: true,
        }))
        .sort(byDate),
    ];

    const inPool = [
      ...selected
        .filter((t) => t.type === "in" && t.status === "pending")
        .map((t) => ({
          ...t,
          remaining: (t.totalAmount ?? 0) - (t.paidAmount ?? 0),
          isAdvance: false,
        }))
        .filter((t) => t.remaining > 0)
        .sort(byDate),
      ...selected
        .filter(
          (t) =>
            t.type === "out" && (t.totalAmount ?? 0) - (t.paidAmount ?? 0) < 0,
        )
        .map((t) => ({
          ...t,
          remaining: Math.abs((t.totalAmount ?? 0) - (t.paidAmount ?? 0)),
          isAdvance: true,
        }))
        .sort(byDate),
    ];

    const settlementMap = {};
    selected.forEach((t) => {
      settlementMap[t.id] = { amount: 0 };
    });

    let oi = 0,
      ii = 0;
    while (oi < outPool.length && ii < inPool.length) {
      const outTx = outPool[oi];
      const inTx = inPool[ii];
      const offset = Math.min(outTx.remaining, inTx.remaining);
      if (offset > 0) {
        settlementMap[outTx.id].amount += offset;
        settlementMap[inTx.id].amount += offset;
        outTx.remaining -= offset;
        inTx.remaining -= offset;
      }
      if (outTx.remaining <= 0.001) oi++;
      if (inTx.remaining <= 0.001) ii++;
    }

    const totalSettled =
      Object.values(settlementMap).reduce((s, v) => s + v.amount, 0) / 2;

    const affectedCount = Object.values(settlementMap).filter(
      (v) => v.amount > 0,
    ).length;

    const previews = selected.map((tx) => {
      const settled = settlementMap[tx.id]?.amount ?? 0;
      const currentRemaining = (tx.totalAmount ?? 0) - (tx.paidAmount ?? 0);
      const isAdvanceTx = currentRemaining < 0;
      const oldRemaining = isAdvanceTx
        ? Math.abs(currentRemaining)
        : currentRemaining;
      const newRemaining = Math.max(0, oldRemaining - settled);
      const willComplete = newRemaining <= 0.001 && settled > 0;
      return {
        tx,
        settled,
        oldRemaining,
        newRemaining,
        willComplete,
        isAdvanceTx,
      };
    });

    return { previews, totalSettled, affectedCount };
  };

  // ── Summary ───────────────────────────────────────────────────────────────
  //
  // "toReceive" = net money owed TO us across all transactions
  // "toGive"    = net money we owe across all transactions
  //
  // Rules per transaction:
  //   pending out (remaining > 0)  → toReceive += remaining
  //   pending in  (remaining > 0)  → toGive    += remaining
  //   overpaid out (remaining < 0) → customer gave us extra, we owe them back
  //                                  → toGive += |remaining|
  //   overpaid in  (remaining < 0) → we overpaid supplier, they owe us back
  //                                  → toReceive += |remaining|
  //
  // This means both toReceive and toGive are always ≥ 0, and net = toReceive − toGive.
  //
  const summary = transactions.reduce(
    (acc, tx) => {
      const remaining = (tx.totalAmount ?? 0) - (tx.paidAmount ?? 0);
      const isOverpaid = remaining < 0;
      const isPending = tx.status === "pending";

      // Count pending transactions for display subtitles.
      // Only count when remaining > 0 — overpaid-pending txs (remaining < 0)
      // are already counted via overpaidOut/overpaidIn, not here.
      if (isPending && remaining > 0) {
        acc.totalPending += 1;
        if (tx.type === "out") acc.pendingOut += 1;
        else acc.pendingIn += 1;
      }

      // Receivable contributions
      if (isPending && tx.type === "out" && remaining > 0) {
        // Sale, customer still owes us
        acc.toReceive += remaining;
      } else if (isOverpaid && tx.type === "in") {
        // We overpaid supplier → supplier owes us back → receivable
        acc.toReceive += Math.abs(remaining);
        acc.overpaidIn += 1;
      }

      // Payable contributions
      if (isPending && tx.type === "in" && remaining > 0) {
        // Purchase, we still owe supplier
        acc.toGive += remaining;
      } else if (isOverpaid && tx.type === "out") {
        // Customer overpaid us → we owe them back → payable
        acc.toGive += Math.abs(remaining);
        acc.overpaidOut += 1;
      }

      return acc;
    },
    {
      toReceive: 0,
      toGive: 0,
      pendingOut: 0,
      pendingIn: 0,
      totalPending: 0,
      overpaidOut: 0, // sales where customer overpaid us (we owe them)
      overpaidIn: 0, // purchases where we overpaid supplier (they owe us)
    },
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
    settleTransactions,
    computeSettlementPreview,
  };
};
