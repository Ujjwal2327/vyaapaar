import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

// Module-level — stable across renders, safe to use inside useEffect closures.
const rowToTransaction = (row) => ({
  id: row.id,
  type: row.type,
  kind: row.kind,
  contactId: row.contact_id,
  linkedContactIds: row.linked_contact_ids ?? [],
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

// Derive status from paid vs total amounts.
const deriveStatus = (paidAmount, totalAmount) => {
  if (totalAmount <= 0) return "pending";
  if (paidAmount > totalAmount) return "overpaid";
  if (paidAmount >= totalAmount) return "complete";
  return "pending";
};

export const useTransactions = (contactId) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasFetched = useRef(false);

  const prevUserIdRef = useRef(null);

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
    const currentUserId = user?.id ?? null;
    if (hasFetched.current && currentUserId !== prevUserIdRef.current) {
      hasFetched.current = false;
      setTransactions([]);
    }
    prevUserIdRef.current = currentUserId;
  }, [contactId, user]);

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
        // Fetch transactions where this contact is PRIMARY owner
        const { data: primaryData, error: primaryErr } = await supabase
          .from("transactions")
          .select("*")
          .eq("contact_id", contactId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (primaryErr) throw primaryErr;

        // Fetch transactions where this contact is a LINKED (secondary) contact
        const { data: linkedData, error: linkedErr } = await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .contains("linked_contact_ids", [contactId])
          .order("created_at", { ascending: false });

        if (linkedErr) throw linkedErr;

        // Merge, deduplicate (a tx can't be both primary and linked for same contact)
        const primaryRows = (primaryData ?? []).map((r) => ({
          ...rowToTransaction(r),
          _role: "primary", // ephemeral UI flag
        }));

        const linkedIds = new Set(primaryRows.map((t) => t.id));
        const linkedRows = (linkedData ?? [])
          .filter((r) => !linkedIds.has(r.id))
          .map((r) => ({
            ...rowToTransaction(r),
            _role: "linked",
          }));

        const rows = [...primaryRows, ...linkedRows];
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

  const transactionToRow = (tx) => ({
    id: tx.id,
    user_id: user.id,
    contact_id: tx.contactId ?? contactId,
    linked_contact_ids: tx.linkedContactIds ?? [],
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
      linkedContactIds: newTx.linkedContactIds ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _role: "primary",
    };

    const row = transactionToRow(tx);
    const { error: err } = await supabase.from("transactions").insert([row]);
    if (err) throw err;

    setTransactions((prev) => {
      const updated = [tx, ...prev];
      saveToLocal(updated);
      return updated;
    });
    return tx;
  };

  const updateTransaction = async (txId, updates) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    const { data: freshRows, error: fetchErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", txId)
      .eq("user_id", user.id)
      .limit(1);

    if (fetchErr) throw fetchErr;

    const freshRow = freshRows?.[0];
    if (!freshRow) throw new Error("Transaction not found");

    const existing = rowToTransaction(freshRow);

    const merged = {
      ...existing,
      ...updates,
      paidAmount: existing.paidAmount,
      paidAmountHistory: existing.paidAmountHistory,
      id: txId,
      updatedAt: new Date().toISOString(),
    };

    const newTotal = parseFloat(merged.totalAmount) || 0;
    merged.status = deriveStatus(merged.paidAmount, newTotal);

    const row = transactionToRow(merged);
    const { error: err } = await supabase
      .from("transactions")
      .upsert([row], { onConflict: "id" });

    if (err) throw err;

    setTransactions((prev) => {
      const current = prev.find((t) => t.id === txId);
      if (!current) return prev;
      const localMerged = {
        ...current,
        ...updates,
        paidAmount: merged.paidAmount,
        paidAmountHistory: merged.paidAmountHistory,
        status: merged.status,
        id: txId,
        updatedAt: merged.updatedAt,
      };
      const newList = prev.map((t) => (t.id === txId ? localMerged : t));
      saveToLocal(newList);
      return newList;
    });
    return merged;
  };

  const deleteTransaction = async (txId) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    const now = new Date().toISOString();

    const { data: targetRows, error: targetFetchErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", txId)
      .eq("user_id", user.id)
      .limit(1);

    if (targetFetchErr) throw targetFetchErr;
    if (!targetRows?.[0]) throw new Error("Transaction not found");

    const target = rowToTransaction(targetRows[0]);

    const deletedTx = {
      ...target,
      status: "deleted",
      updatedAt: now,
    };

    let allContactTxRows = [];
    {
      const { data: contactRows, error: contactFetchErr } = await supabase
        .from("transactions")
        .select("*")
        .eq("contact_id", contactId)
        .eq("user_id", user.id)
        .neq("status", "deleted");

      if (contactFetchErr) throw contactFetchErr;
      allContactTxRows = contactRows ?? [];
    }

    const partnerIds = allContactTxRows
      .filter((row) => {
        if (row.id === txId) return false;
        const history = row.paid_amount_history ?? [];
        return history.some(
          (entry) =>
            (entry.method === "settlement" ||
              entry.method === "advance-applied") &&
            Array.isArray(entry.partnerIds) &&
            entry.partnerIds.includes(txId),
        );
      })
      .map((row) => row.id);

    const freshPartners =
      partnerIds.length > 0
        ? allContactTxRows
            .filter((row) => partnerIds.includes(row.id))
            .map(rowToTransaction)
        : [];

    const updatedPartners = freshPartners.map((partner) => {
      const cleanedHistory = (partner.paidAmountHistory ?? [])
        .map((entry) => {
          const isSettlementEntry =
            entry.method === "settlement" || entry.method === "advance-applied";
          if (!isSettlementEntry) return entry;

          const refsDeletedTx = (entry.partnerIds ?? []).includes(txId);
          if (!refsDeletedTx) return entry;

          const contribution =
            entry.partnerAmounts != null
              ? (entry.partnerAmounts[txId] ?? 0)
              : Math.abs(entry.amount);

          const remainingPartners = (entry.partnerIds ?? []).filter(
            (pid) => pid !== txId,
          );

          const sign = entry.amount < 0 ? -1 : 1;
          const newAbsAmount = Math.abs(entry.amount) - contribution;

          if (remainingPartners.length === 0 || newAbsAmount <= 0.001) {
            return null;
          }

          const newPartnerAmounts = entry.partnerAmounts
            ? Object.fromEntries(
                Object.entries(entry.partnerAmounts).filter(
                  ([pid]) => pid !== txId,
                ),
              )
            : undefined;

          return {
            ...entry,
            amount: sign * newAbsAmount,
            partnerIds: remainingPartners,
            ...(newPartnerAmounts !== undefined
              ? { partnerAmounts: newPartnerAmounts }
              : {}),
          };
        })
        .filter(Boolean);

      const newPaid = cleanedHistory.reduce(
        (sum, e) => sum + (e.amount ?? 0),
        0,
      );

      const total = partner.totalAmount ?? 0;
      const newStatus = deriveStatus(newPaid, total);

      return {
        ...partner,
        paidAmount: newPaid,
        paidAmountHistory: cleanedHistory,
        status: newStatus,
        updatedAt: now,
      };
    });

    const allToWrite = [deletedTx, ...updatedPartners];
    const { error: batchErr } = await supabase
      .from("transactions")
      .upsert(allToWrite.map(transactionToRow), { onConflict: "id" });
    if (batchErr) throw batchErr;

    setTransactions((prev) => {
      const partnerMap = Object.fromEntries(
        updatedPartners.map((p) => [p.id, p]),
      );
      const existingIds = new Set(prev.map((t) => t.id));
      const newList = prev.map((t) => {
        if (t.id === txId) return deletedTx;
        if (partnerMap[t.id]) return partnerMap[t.id];
        return t;
      });
      for (const partner of updatedPartners) {
        if (!existingIds.has(partner.id)) newList.push(partner);
      }
      saveToLocal(newList);
      return newList;
    });
  };

  const addPayment = async (txId, payment) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    const { data: freshRows, error: fetchErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", txId)
      .eq("user_id", user.id)
      .limit(1);

    if (fetchErr) throw fetchErr;

    const freshRow = freshRows?.[0];
    if (!freshRow) throw new Error("Transaction not found");

    const existing = rowToTransaction(freshRow);

    const newEntry = {
      amount: payment.amount,
      note: payment.note ?? "",
      method: payment.method ?? "cash",
      date: new Date().toISOString(),
    };

    const newPaid = (existing.paidAmount ?? 0) + payment.amount;
    const dbUpdates = {
      paidAmount: newPaid,
      paidAmountHistory: [...(existing.paidAmountHistory ?? []), newEntry],
      status: deriveStatus(newPaid, existing.totalAmount ?? 0),
    };

    const updatedForDb = {
      ...existing,
      ...dbUpdates,
      id: txId,
      updatedAt: new Date().toISOString(),
    };

    const { error: err } = await supabase
      .from("transactions")
      .upsert([transactionToRow(updatedForDb)], { onConflict: "id" });

    if (err) throw err;

    setTransactions((prev) => {
      const newList = prev.map((t) =>
        t.id === txId ? { ...updatedForDb, _role: t._role } : t,
      );
      saveToLocal(newList);
      return newList;
    });

    return updatedForDb;
  };

  const settleTransactions = async (txIds) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    // Only settle PRIMARY transactions (linked ones are read-only for settlement)
    const selected = txIds
      .map((id) => transactions.find((t) => t.id === id))
      .filter(Boolean)
      .filter((t) => {
        if (t.status === "deleted") return false;
        if (t._role === "linked") return false; // never settle linked-only txs
        const rem = (t.totalAmount ?? 0) - (t.paidAmount ?? 0);
        if (t.status === "pending") return rem > 0;
        return rem < 0;
      });

    if (selected.length < 2)
      throw new Error("Need at least 2 eligible transactions");

    const { data: freshRows, error: fetchErr } = await supabase
      .from("transactions")
      .select("*")
      .in(
        "id",
        selected.map((t) => t.id),
      )
      .eq("user_id", user.id);

    if (fetchErr) throw fetchErr;

    const freshMap = Object.fromEntries(
      (freshRows ?? []).map((r) => [r.id, rowToTransaction(r)]),
    );

    const freshSelected = selected
      .map((t) => freshMap[t.id] ?? t)
      .filter((t) => {
        if (t.status === "deleted") return false;
        const rem = (t.totalAmount ?? 0) - (t.paidAmount ?? 0);
        if (t.status === "pending") return rem > 0;
        return rem < 0;
      });

    const staleCount = selected.length - freshSelected.length;

    if (freshSelected.length < 2)
      throw new Error("Need at least 2 eligible transactions");

    const settledAt = new Date().toISOString();
    const settlementGroupId = crypto.randomUUID();

    const byDate = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);

    const outPool = [
      ...freshSelected
        .filter((t) => t.type === "out" && t.status === "pending")
        .map((t) => ({
          ...t,
          remaining: (t.totalAmount ?? 0) - (t.paidAmount ?? 0),
          isAdvance: false,
        }))
        .filter((t) => t.remaining > 0)
        .sort(byDate),
      ...freshSelected
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
      ...freshSelected
        .filter((t) => t.type === "in" && t.status === "pending")
        .map((t) => ({
          ...t,
          remaining: (t.totalAmount ?? 0) - (t.paidAmount ?? 0),
          isAdvance: false,
        }))
        .filter((t) => t.remaining > 0)
        .sort(byDate),
      ...freshSelected
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
    freshSelected.forEach((t) => {
      settlementMap[t.id] = { amount: 0, partnerIds: [], partnerAmounts: {} };
    });

    let oi = 0,
      ii = 0;
    while (oi < outPool.length && ii < inPool.length) {
      const outTx = outPool[oi];
      const inTx = inPool[ii];
      const offset = Math.min(outTx.remaining, inTx.remaining);
      if (offset > 0) {
        settlementMap[outTx.id].amount += offset;
        if (!settlementMap[outTx.id].partnerIds.includes(inTx.id))
          settlementMap[outTx.id].partnerIds.push(inTx.id);
        settlementMap[outTx.id].partnerAmounts[inTx.id] =
          (settlementMap[outTx.id].partnerAmounts[inTx.id] ?? 0) + offset;

        settlementMap[inTx.id].amount += offset;
        if (!settlementMap[inTx.id].partnerIds.includes(outTx.id))
          settlementMap[inTx.id].partnerIds.push(outTx.id);
        settlementMap[inTx.id].partnerAmounts[outTx.id] =
          (settlementMap[inTx.id].partnerAmounts[outTx.id] ?? 0) + offset;

        outTx.remaining -= offset;
        inTx.remaining -= offset;
      }
      if (outTx.remaining <= 0.001) oi++;
      if (inTx.remaining <= 0.001) ii++;
    }

    const updatedTxs = {};
    const now = new Date().toISOString();

    for (const tx of freshSelected) {
      const settlement = settlementMap[tx.id];
      if (settlement.amount <= 0) continue;

      const existing = freshMap[tx.id] ?? tx;
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
        newPaid = (existing.paidAmount ?? 0) - settlement.amount;
        historyEntry = {
          amount: -settlement.amount,
          note: partnerNote,
          method: "advance-applied",
          date: settledAt,
          settlementGroupId,
          partnerIds: settlement.partnerIds,
          partnerAmounts: settlement.partnerAmounts,
          balanceBefore: currentRemaining,
          balanceAfter: currentRemaining + settlement.amount,
        };
      } else {
        newPaid = (existing.paidAmount ?? 0) + settlement.amount;
        historyEntry = {
          amount: settlement.amount,
          note: partnerNote,
          method: "settlement",
          date: settledAt,
          settlementGroupId,
          partnerIds: settlement.partnerIds,
          partnerAmounts: settlement.partnerAmounts,
          balanceBefore: currentRemaining,
          balanceAfter: currentRemaining - settlement.amount,
        };
      }

      const newStatus = deriveStatus(newPaid, existing.totalAmount ?? 0);

      updatedTxs[tx.id] = {
        ...existing,
        paidAmount: newPaid,
        paidAmountHistory: [...existing.paidAmountHistory, historyEntry],
        status: newStatus,
        updatedAt: now,
      };
    }

    const rowsToWrite = Object.values(updatedTxs).map(transactionToRow);
    if (rowsToWrite.length > 0) {
      const { error: batchErr } = await supabase
        .from("transactions")
        .upsert(rowsToWrite, { onConflict: "id" });
      if (batchErr) throw batchErr;
    }

    setTransactions((prev) => {
      const existingIds = new Set(prev.map((t) => t.id));
      const newList = prev.map((t) =>
        updatedTxs[t.id] ? { ...updatedTxs[t.id], _role: t._role } : t,
      );
      for (const updated of Object.values(updatedTxs)) {
        if (!existingIds.has(updated.id)) newList.push(updated);
      }
      saveToLocal(newList);
      return newList;
    });

    return { settlementGroupId, staleCount };
  };

  const computeSettlementPreview = useCallback(
    async (txIds) => {
      const localSelected = txIds
        .map((id) => transactions.find((t) => t.id === id))
        .filter(Boolean)
        .filter((t) => {
          if (t.status === "deleted") return false;
          if (t._role === "linked") return false;
          const rem = (t.totalAmount ?? 0) - (t.paidAmount ?? 0);
          if (t.status === "pending") return rem > 0;
          return rem < 0;
        });

      let selected = localSelected;
      if (user && localSelected.length > 0) {
        try {
          const { data: freshRows } = await supabase
            .from("transactions")
            .select("*")
            .in(
              "id",
              localSelected.map((t) => t.id),
            )
            .eq("user_id", user.id);

          if (freshRows && freshRows.length > 0) {
            const freshMap = Object.fromEntries(
              freshRows.map((r) => [r.id, rowToTransaction(r)]),
            );
            selected = localSelected
              .map((t) => freshMap[t.id] ?? t)
              .filter((t) => {
                if (t.status === "deleted") return false;
                const rem = (t.totalAmount ?? 0) - (t.paidAmount ?? 0);
                if (t.status === "pending") return rem > 0;
                return rem < 0;
              });
          }
        } catch {
          // Fall back to local state on fetch error
        }
      }

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
              t.type === "out" &&
              (t.totalAmount ?? 0) - (t.paidAmount ?? 0) < 0,
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
    },
    [transactions, user],
  );

  const netSettle = async ({ note, method } = {}) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    // netSettle only considers PRIMARY transactions
    const { data: freshRows, error: fetchErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("contact_id", contactId)
      .eq("user_id", user.id)
      .neq("status", "deleted");

    if (fetchErr) throw fetchErr;

    const freshTxs = (freshRows ?? []).map(rowToTransaction);

    let toReceive = 0;
    let toGive = 0;
    for (const tx of freshTxs) {
      const remaining = (tx.totalAmount ?? 0) - (tx.paidAmount ?? 0);
      if (tx.status === "pending" && tx.type === "out" && remaining > 0)
        toReceive += remaining;
      else if (tx.status === "overpaid" && tx.type === "in")
        toReceive += Math.abs(remaining);
      if (tx.status === "pending" && tx.type === "in" && remaining > 0)
        toGive += remaining;
      else if (tx.status === "overpaid" && tx.type === "out")
        toGive += Math.abs(remaining);
    }

    const netAmount = Math.round((toReceive - toGive) * 100) / 100;
    if (Math.abs(netAmount) < 0.01)
      throw new Error("Net balance is zero — nothing to settle");

    const balancingType = netAmount > 0 ? "in" : "out";
    const balancingAmount = Math.abs(netAmount);
    const now = new Date().toISOString();
    const balancingTxId = crypto.randomUUID();
    const settlementGroupId = crypto.randomUUID();

    const baseNote = `Net settlement via ${method ?? "cash"}`;
    const balancingTxNote = note?.trim()
      ? `${baseNote} · ${note.trim()}`
      : baseNote;

    const balancingRow = {
      id: balancingTxId,
      user_id: user.id,
      contact_id: contactId,
      linked_contact_ids: [],
      type: balancingType,
      kind: "financial",
      items_list: [],
      additional_amounts: [],
      total_amount: balancingAmount,
      paid_amount: 0,
      paid_amount_history: [],
      item_list_history: [],
      note: balancingTxNote,
      status: "pending",
    };

    const balancingTx = rowToTransaction({
      ...balancingRow,
      created_at: now,
      updated_at: now,
      contact_id: contactId,
    });

    const eligibleExisting = freshTxs.filter((t) => {
      const rem = (t.totalAmount ?? 0) - (t.paidAmount ?? 0);
      if (t.status === "pending") return rem > 0;
      if (t.status === "overpaid") return true;
      return false;
    });

    const allParticipants = [...eligibleExisting, balancingTx];

    if (allParticipants.length < 2)
      throw new Error("Not enough eligible transactions to settle");

    const settledAt = now;
    const byDate = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);

    const outPool = [
      ...allParticipants
        .filter((t) => t.type === "out" && t.status === "pending")
        .map((t) => ({
          ...t,
          remaining: (t.totalAmount ?? 0) - (t.paidAmount ?? 0),
          isAdvance: false,
        }))
        .filter((t) => t.remaining > 0)
        .sort(byDate),
      ...allParticipants
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
      ...allParticipants
        .filter((t) => t.type === "in" && t.status === "pending")
        .map((t) => ({
          ...t,
          remaining: (t.totalAmount ?? 0) - (t.paidAmount ?? 0),
          isAdvance: false,
        }))
        .filter((t) => t.remaining > 0)
        .sort(byDate),
      ...allParticipants
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
    allParticipants.forEach((t) => {
      settlementMap[t.id] = { amount: 0, partnerIds: [], partnerAmounts: {} };
    });

    let oi = 0,
      ii = 0;
    while (oi < outPool.length && ii < inPool.length) {
      const outTx = outPool[oi];
      const inTx = inPool[ii];
      const offset = Math.min(outTx.remaining, inTx.remaining);
      if (offset > 0) {
        settlementMap[outTx.id].amount += offset;
        if (!settlementMap[outTx.id].partnerIds.includes(inTx.id))
          settlementMap[outTx.id].partnerIds.push(inTx.id);
        settlementMap[outTx.id].partnerAmounts[inTx.id] =
          (settlementMap[outTx.id].partnerAmounts[inTx.id] ?? 0) + offset;

        settlementMap[inTx.id].amount += offset;
        if (!settlementMap[inTx.id].partnerIds.includes(outTx.id))
          settlementMap[inTx.id].partnerIds.push(outTx.id);
        settlementMap[inTx.id].partnerAmounts[outTx.id] =
          (settlementMap[inTx.id].partnerAmounts[outTx.id] ?? 0) + offset;

        outTx.remaining -= offset;
        inTx.remaining -= offset;
      }
      if (outTx.remaining <= 0.001) oi++;
      if (inTx.remaining <= 0.001) ii++;
    }

    const freshMap = Object.fromEntries(freshTxs.map((t) => [t.id, t]));
    freshMap[balancingTxId] = balancingTx;

    const updatedTxs = {};

    for (const tx of allParticipants) {
      const settlement = settlementMap[tx.id];
      if (!settlement || settlement.amount <= 0) continue;

      const existing = freshMap[tx.id] ?? tx;
      const currentRemaining =
        (existing.totalAmount ?? 0) - (existing.paidAmount ?? 0);
      const isAdvanceTx = currentRemaining < 0;

      const partnerNote =
        settlement.partnerIds.length > 0
          ? `Settled against: ${settlement.partnerIds.map((id) => id.slice(0, 8)).join(", ")}`
          : "Net settlement";

      let newPaid;
      let historyEntry;

      if (isAdvanceTx) {
        newPaid = (existing.paidAmount ?? 0) - settlement.amount;
        historyEntry = {
          amount: -settlement.amount,
          note: partnerNote,
          method: "advance-applied",
          date: settledAt,
          settlementGroupId,
          partnerIds: settlement.partnerIds,
          partnerAmounts: settlement.partnerAmounts,
          balanceBefore: currentRemaining,
          balanceAfter: currentRemaining + settlement.amount,
        };
      } else {
        newPaid = (existing.paidAmount ?? 0) + settlement.amount;
        historyEntry = {
          amount: settlement.amount,
          note: partnerNote,
          method: "settlement",
          date: settledAt,
          settlementGroupId,
          partnerIds: settlement.partnerIds,
          partnerAmounts: settlement.partnerAmounts,
          balanceBefore: currentRemaining,
          balanceAfter: currentRemaining - settlement.amount,
        };
      }

      const newStatus = deriveStatus(newPaid, existing.totalAmount ?? 0);

      const baseHistory = existing.paidAmountHistory ?? [];
      updatedTxs[tx.id] = {
        ...existing,
        paidAmount: newPaid,
        paidAmountHistory: [...baseHistory, historyEntry],
        status: newStatus,
        updatedAt: now,
      };
    }

    if (!updatedTxs[balancingTxId]) {
      updatedTxs[balancingTxId] = balancingTx;
    }

    const allRows = Object.values(updatedTxs).map(transactionToRow);
    const { error: batchErr } = await supabase
      .from("transactions")
      .upsert(allRows, { onConflict: "id" });
    if (batchErr) throw batchErr;

    const finalBalancing = updatedTxs[balancingTxId] ?? balancingTx;

    setTransactions((prev) => {
      const existingIds = new Set(prev.map((t) => t.id));
      const newList = prev.map((t) =>
        updatedTxs[t.id] ? { ...updatedTxs[t.id], _role: t._role } : t,
      );
      if (!existingIds.has(balancingTxId))
        newList.unshift({ ...finalBalancing, _role: "primary" });
      for (const updated of Object.values(updatedTxs)) {
        if (!existingIds.has(updated.id) && updated.id !== balancingTxId)
          newList.push(updated);
      }
      saveToLocal(newList);
      return newList;
    });

    return { settlementGroupId, balancingTxId, staleCount: 0 };
  };

  // Summary: ONLY counts primary transactions (where this contact is the financial owner)
  const summary = transactions.reduce(
    (acc, tx) => {
      if (tx.status === "deleted") return acc;
      if (tx._role === "linked") return acc; // exclude linked-only from summary

      const remaining = (tx.totalAmount ?? 0) - (tx.paidAmount ?? 0);
      const isOverpaid = remaining < 0;
      const isPending = tx.status === "pending";

      if (isPending && remaining > 0) {
        acc.totalPending += 1;
        if (tx.type === "out") acc.pendingOut += 1;
        else acc.pendingIn += 1;
      }

      if (isPending && tx.type === "out" && remaining > 0) {
        acc.toReceive += remaining;
      } else if (isOverpaid && tx.type === "in") {
        acc.toReceive += Math.abs(remaining);
        acc.overpaidIn += 1;
      }

      if (isPending && tx.type === "in" && remaining > 0) {
        acc.toGive += remaining;
      } else if (isOverpaid && tx.type === "out") {
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
      overpaidOut: 0,
      overpaidIn: 0,
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
    netSettle,
  };
};
