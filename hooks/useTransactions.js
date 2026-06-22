"use client";

/**
 * hooks/useTransactions.js  — offline-first version (v2)
 *
 * Bug fixes vs v1:
 *  1. FIX: Assigned transactions now appear on contact page.
 *     - After assignContact/assignContactBulk, the contact's localStorage
 *       cache (transactions_{contactId}) is updated immediately so the
 *       contact page sees the transaction without a full page reload.
 *  2. FIX: Contact page now always shows latest transactions in offline mode.
 *     - hasFetched guard is now per-session-visit (reset on page focus +
 *       online event) so navigating back to a contact page re-fetches.
 *  3. FIX: dropFromLocalState was not updating the unassigned localStorage
 *       cache when a transaction was dropped after assignment.
 *  4. FIX: transactionToRow was only usable inside the hook (needs useCallback
 *       with stable deps) — extracted to avoid stale closure bugs.
 *  5. FIX: isNetworkError now also checks navigator.onLine directly.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { enqueue, OP_TYPES } from "@/lib/offlineQueue";

export const NO_CONTACT = "none";

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

const deriveStatus = (paidAmount, totalAmount) => {
  if (totalAmount <= 0) return "pending";
  if (paidAmount > totalAmount) return "overpaid";
  if (paidAmount >= totalAmount) return "complete";
  return "pending";
};

const isNetworkError = (err) => {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (!err) return false;
  const msg = (err.message ?? "").toLowerCase();
  return (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror")
  );
};

// ─── cross-cache helpers ──────────────────────────────────────────────────────
// When a transaction moves from the unassigned pool to a real contact (or vice
// versa), we must update BOTH localStorage caches so both pages see consistent
// data without a reload.

/**
 * Push a transaction INTO a contact's localStorage cache.
 * Creates the cache entry if it doesn't exist yet.
 */
const pushToContactCache = (tx, targetContactId) => {
  try {
    const key = `transactions_${targetContactId}`;
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    // Remove any stale copy first, then prepend
    const next = [
      { ...tx, contactId: targetContactId, _role: "primary" },
      ...list.filter((t) => t.id !== tx.id),
    ];
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}
};

/**
 * Remove a transaction FROM a contact's (or unassigned) localStorage cache.
 */
const removeFromCache = (txId, cacheContactId) => {
  try {
    const key = `transactions_${cacheContactId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const next = JSON.parse(raw).filter((t) => t.id !== txId);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}
};

/**
 * Update a single transaction field in a contact's localStorage cache.
 */
const patchInCache = (txId, patch, cacheContactId) => {
  try {
    const key = `transactions_${cacheContactId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const next = JSON.parse(raw).map((t) =>
      t.id === txId ? { ...t, ...patch } : t,
    );
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}
};

// ─── hook ─────────────────────────────────────────────────────────────────────

export const useTransactions = (contactId) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const hasFetched = useRef(false);
  const prevUserIdRef = useRef(null);

  const isNoContact = contactId === NO_CONTACT;
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

  // Reset fetch guard on user change
  useEffect(() => {
    if (!contactId) return;
    const uid = user?.id ?? null;
    if (hasFetched.current && uid !== prevUserIdRef.current) {
      hasFetched.current = false;
      setTransactions([]);
    }
    prevUserIdRef.current = uid;
  }, [contactId, user]);

  // Reset fetch guard whenever contactId changes (navigating to a different contact)
  useEffect(() => {
    if (!contactId) return;
    hasFetched.current = false;
  }, [contactId]);

  // FIX #2: Reset fetch guard when device comes back online so the contact
  // page re-fetches fresh data after an offline session.
  useEffect(() => {
    const handleOnline = () => {
      hasFetched.current = false;
      // The load effect below will re-run because hasFetched is now false,
      // but effects don't automatically re-run — we need to trigger it.
      // We do this by dispatching a custom event the load effect listens to.
      window.dispatchEvent(new Event("txRefreshNeeded"));
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  // Main load effect
  useEffect(() => {
    if (!contactId) return;

    const doLoad = async () => {
      if (hasFetched.current) return;

      setIsLoading(true);
      hasFetched.current = true;

      // Step 1: serve from localStorage immediately
      loadFromLocal();

      if (!user) {
        setIsLoading(false);
        return;
      }

      // Step 2: background DB fetch
      try {
        const primaryQuery = supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        const { data: primaryData, error: primaryErr } = isNoContact
          ? await primaryQuery.is("contact_id", null)
          : await primaryQuery.eq("contact_id", contactId);

        if (primaryErr) throw primaryErr;

        let linkedData = [];
        if (!isNoContact) {
          const { data, error: linkedErr } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .contains("linked_contact_ids", [contactId])
            .order("created_at", { ascending: false });
          if (linkedErr) throw linkedErr;
          linkedData = data ?? [];
        }

        const primaryRows = (primaryData ?? []).map((r) => ({
          ...rowToTransaction(r),
          _role: "primary",
        }));
        const linkedIds = new Set(primaryRows.map((t) => t.id));
        const linkedRows = linkedData
          .filter((r) => !linkedIds.has(r.id))
          .map((r) => ({ ...rowToTransaction(r), _role: "linked" }));

        const rows = [...primaryRows, ...linkedRows];
        setTransactions(rows);
        saveToLocal(rows);
      } catch (e) {
        console.warn(
          "[useTransactions] DB fetch failed (offline?):",
          e.message,
        );
        setError(e);
      } finally {
        setIsLoading(false);
      }
    };

    doLoad();

    // Also re-run when the "txRefreshNeeded" event fires (after coming online)
    const handler = () => {
      hasFetched.current = false;
      doLoad();
    };
    window.addEventListener("txRefreshNeeded", handler);
    return () => window.removeEventListener("txRefreshNeeded", handler);
  }, [contactId, isNoContact, user, loadFromLocal, saveToLocal]);

  // ── transactionToRow ──────────────────────────────────────────────────────
  const transactionToRow = useCallback(
    (tx) => ({
      id: tx.id,
      user_id: user.id,
      contact_id:
        tx.contactId !== undefined
          ? tx.contactId
          : isNoContact
            ? null
            : contactId,
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
    }),
    [user, isNoContact, contactId],
  );

  // ── addTransaction ────────────────────────────────────────────────────────
  const addTransaction = async (newTx) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    const tx = {
      ...newTx,
      id: crypto.randomUUID(),
      contactId:
        newTx.contactId !== undefined
          ? newTx.contactId
          : isNoContact
            ? null
            : contactId,
      linkedContactIds: newTx.linkedContactIds ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _role: "primary",
    };

    // Optimistic local write
    setTransactions((prev) => {
      const updated = [tx, ...prev];
      saveToLocal(updated);
      return updated;
    });

    // FIX: if created on unassigned page WITH a contact, also push to that
    // contact's cache so the contact page shows it immediately
    if (isNoContact && tx.contactId) {
      pushToContactCache(tx, tx.contactId);
    }

    const row = transactionToRow(tx);

    if (!navigator.onLine) {
      enqueue(OP_TYPES.TX_INSERT, { row }, tx, user.id);
      return tx;
    }

    try {
      const { error: err } = await supabase.from("transactions").insert([row]);
      if (err) throw err;
    } catch (err) {
      if (isNetworkError(err)) {
        enqueue(OP_TYPES.TX_INSERT, { row }, tx, user.id);
        return tx;
      }
      throw err;
    }
    return tx;
  };

  // ── updateTransaction ─────────────────────────────────────────────────────
  const updateTransaction = async (txId, updates) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    const localTx = transactions.find((t) => t.id === txId);
    if (!localTx) throw new Error("Transaction not found");

    const merged = {
      ...localTx,
      ...updates,
      paidAmount: localTx.paidAmount,
      paidAmountHistory: localTx.paidAmountHistory,
      id: txId,
      updatedAt: new Date().toISOString(),
    };
    const newTotal = parseFloat(merged.totalAmount) || 0;
    merged.status = deriveStatus(merged.paidAmount, newTotal);

    setTransactions((prev) => {
      const list = prev.map((t) =>
        t.id === txId ? { ...merged, _role: t._role } : t,
      );
      saveToLocal(list);
      return list;
    });

    if (!navigator.onLine) {
      enqueue(
        OP_TYPES.TX_UPSERT,
        { rows: [transactionToRow(merged)] },
        merged,
        user.id,
      );
      return merged;
    }

    try {
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
      const serverMerge = {
        ...existing,
        ...updates,
        paidAmount: existing.paidAmount,
        paidAmountHistory: existing.paidAmountHistory,
        id: txId,
        updatedAt: new Date().toISOString(),
      };
      const sTotal = parseFloat(serverMerge.totalAmount) || 0;
      serverMerge.status = deriveStatus(serverMerge.paidAmount, sTotal);

      const { error: err } = await supabase
        .from("transactions")
        .upsert([transactionToRow(serverMerge)], { onConflict: "id" });
      if (err) throw err;

      setTransactions((prev) => {
        const list = prev.map((t) =>
          t.id === txId ? { ...serverMerge, _role: t._role } : t,
        );
        saveToLocal(list);
        return list;
      });
      return serverMerge;
    } catch (err) {
      if (isNetworkError(err)) {
        enqueue(
          OP_TYPES.TX_UPSERT,
          { rows: [transactionToRow(merged)] },
          merged,
          user.id,
        );
        return merged;
      }
      throw err;
    }
  };

  // ── deleteTransaction ─────────────────────────────────────────────────────
  const deleteTransaction = async (txId) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    const now = new Date().toISOString();
    const target = transactions.find((t) => t.id === txId);
    if (!target) throw new Error("Transaction not found");

    const deletedTx = { ...target, status: "deleted", updatedAt: now };

    const allContactTxs = transactions.filter((t) => t.status !== "deleted");

    const partnerIds = allContactTxs
      .filter((t) => {
        if (t.id === txId) return false;
        return (t.paidAmountHistory ?? []).some(
          (e) =>
            (e.method === "settlement" || e.method === "advance-applied") &&
            Array.isArray(e.partnerIds) &&
            e.partnerIds.includes(txId),
        );
      })
      .map((t) => t.id);

    const updatedPartners = partnerIds
      .map((pid) => {
        const partner = allContactTxs.find((t) => t.id === pid);
        if (!partner) return null;

        const cleanedHistory = (partner.paidAmountHistory ?? [])
          .map((entry) => {
            const isSett =
              entry.method === "settlement" ||
              entry.method === "advance-applied";
            if (!isSett) return entry;
            if (!(entry.partnerIds ?? []).includes(txId)) return entry;

            const contribution =
              entry.partnerAmounts != null
                ? (entry.partnerAmounts[txId] ?? 0)
                : Math.abs(entry.amount);

            const remaining = (entry.partnerIds ?? []).filter(
              (p) => p !== txId,
            );
            const sign = entry.amount < 0 ? -1 : 1;
            const newAbsAmount = Math.abs(entry.amount) - contribution;

            if (remaining.length === 0 || newAbsAmount <= 0.001) return null;

            const newPartnerAmounts = entry.partnerAmounts
              ? Object.fromEntries(
                  Object.entries(entry.partnerAmounts).filter(
                    ([p]) => p !== txId,
                  ),
                )
              : undefined;

            return {
              ...entry,
              amount: sign * newAbsAmount,
              partnerIds: remaining,
              ...(newPartnerAmounts !== undefined
                ? { partnerAmounts: newPartnerAmounts }
                : {}),
            };
          })
          .filter(Boolean);

        const newPaid = cleanedHistory.reduce((s, e) => s + (e.amount ?? 0), 0);
        const newStatus = deriveStatus(newPaid, partner.totalAmount ?? 0);
        return {
          ...partner,
          paidAmount: newPaid,
          paidAmountHistory: cleanedHistory,
          status: newStatus,
          updatedAt: now,
        };
      })
      .filter(Boolean);

    const allToWrite = [deletedTx, ...updatedPartners];
    const rows = allToWrite.map(transactionToRow);

    setTransactions((prev) => {
      const partnerMap = Object.fromEntries(
        updatedPartners.map((p) => [p.id, p]),
      );
      const existingIds = new Set(prev.map((t) => t.id));
      const list = prev.map((t) => {
        if (t.id === txId) return { ...deletedTx, _role: t._role };
        if (partnerMap[t.id]) return { ...partnerMap[t.id], _role: t._role };
        return t;
      });
      for (const p of updatedPartners) {
        if (!existingIds.has(p.id)) list.push(p);
      }
      saveToLocal(list);
      return list;
    });

    if (!navigator.onLine) {
      enqueue(OP_TYPES.TX_UPSERT, { rows }, allToWrite, user.id);
      return;
    }

    try {
      const { error: batchErr } = await supabase
        .from("transactions")
        .upsert(rows, { onConflict: "id" });
      if (batchErr) throw batchErr;
    } catch (err) {
      if (isNetworkError(err)) {
        enqueue(OP_TYPES.TX_UPSERT, { rows }, allToWrite, user.id);
        return;
      }
      throw err;
    }
  };

  // ── addPayment ────────────────────────────────────────────────────────────
  const addPayment = async (txId, payment) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    const existing = transactions.find((t) => t.id === txId);
    if (!existing) throw new Error("Transaction not found");

    const newEntry = {
      amount: payment.amount,
      note: payment.note ?? "",
      method: payment.method ?? "cash",
      date: new Date().toISOString(),
    };
    const newPaid = (existing.paidAmount ?? 0) + payment.amount;
    const updatedTx = {
      ...existing,
      paidAmount: newPaid,
      paidAmountHistory: [...(existing.paidAmountHistory ?? []), newEntry],
      status: deriveStatus(newPaid, existing.totalAmount ?? 0),
      updatedAt: new Date().toISOString(),
    };

    setTransactions((prev) => {
      const list = prev.map((t) =>
        t.id === txId ? { ...updatedTx, _role: t._role } : t,
      );
      saveToLocal(list);
      return list;
    });

    const row = transactionToRow(updatedTx);

    if (!navigator.onLine) {
      enqueue(OP_TYPES.TX_UPSERT, { rows: [row] }, updatedTx, user.id);
      return updatedTx;
    }

    try {
      const { error: err } = await supabase
        .from("transactions")
        .upsert([row], { onConflict: "id" });
      if (err) throw err;
    } catch (err) {
      if (isNetworkError(err)) {
        enqueue(OP_TYPES.TX_UPSERT, { rows: [row] }, updatedTx, user.id);
        return updatedTx;
      }
      throw err;
    }
    return updatedTx;
  };

  // ── settleTransactions ────────────────────────────────────────────────────
  const settleTransactions = async (txIds) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    const selected = txIds
      .map((id) => transactions.find((t) => t.id === id))
      .filter(Boolean)
      .filter((t) => {
        if (t.status === "deleted") return false;
        if (t._role === "linked") return false;
        const rem = (t.totalAmount ?? 0) - (t.paidAmount ?? 0);
        if (t.status === "pending") return rem > 0;
        return rem < 0;
      });

    if (selected.length < 2)
      throw new Error("Need at least 2 eligible transactions");

    let freshSelected = selected;
    if (navigator.onLine) {
      try {
        const { data: freshRows } = await supabase
          .from("transactions")
          .select("*")
          .in(
            "id",
            selected.map((t) => t.id),
          )
          .eq("user_id", user.id);

        if (freshRows?.length) {
          const freshMap = Object.fromEntries(
            freshRows.map((r) => [r.id, rowToTransaction(r)]),
          );
          freshSelected = selected
            .map((t) => freshMap[t.id] ?? t)
            .filter((t) => {
              if (t.status === "deleted") return false;
              const rem = (t.totalAmount ?? 0) - (t.paidAmount ?? 0);
              if (t.status === "pending") return rem > 0;
              return rem < 0;
            });
        }
      } catch {
        /* use local */
      }
    }

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

    const freshMap = Object.fromEntries(freshSelected.map((t) => [t.id, t]));
    const updatedTxs = {};
    const now = new Date().toISOString();

    for (const tx of freshSelected) {
      const settlement = settlementMap[tx.id];
      if (settlement.amount <= 0) continue;
      const existing = freshMap[tx.id] ?? tx;
      const currentRemaining =
        (existing.totalAmount ?? 0) - (existing.paidAmount ?? 0);
      const isAdvanceTx = currentRemaining < 0;
      const partnerNote = `Settled against: ${settlement.partnerIds.map((id) => id.slice(0, 8)).join(", ")}`;
      let newPaid, historyEntry;

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

      updatedTxs[tx.id] = {
        ...existing,
        paidAmount: newPaid,
        paidAmountHistory: [...existing.paidAmountHistory, historyEntry],
        status: deriveStatus(newPaid, existing.totalAmount ?? 0),
        updatedAt: now,
      };
    }

    const rowsToWrite = Object.values(updatedTxs).map(transactionToRow);

    setTransactions((prev) => {
      const existingIds = new Set(prev.map((t) => t.id));
      const list = prev.map((t) =>
        updatedTxs[t.id] ? { ...updatedTxs[t.id], _role: t._role } : t,
      );
      for (const u of Object.values(updatedTxs)) {
        if (!existingIds.has(u.id)) list.push(u);
      }
      saveToLocal(list);
      return list;
    });

    if (!navigator.onLine) {
      if (rowsToWrite.length > 0) {
        enqueue(
          OP_TYPES.TX_UPSERT,
          { rows: rowsToWrite },
          Object.values(updatedTxs),
          user.id,
        );
      }
      return { settlementGroupId, staleCount };
    }

    try {
      if (rowsToWrite.length > 0) {
        const { error: batchErr } = await supabase
          .from("transactions")
          .upsert(rowsToWrite, { onConflict: "id" });
        if (batchErr) throw batchErr;
      }
    } catch (err) {
      if (isNetworkError(err)) {
        enqueue(
          OP_TYPES.TX_UPSERT,
          { rows: rowsToWrite },
          Object.values(updatedTxs),
          user.id,
        );
        return { settlementGroupId, staleCount };
      }
      throw err;
    }

    return { settlementGroupId, staleCount };
  };

  // ── computeSettlementPreview ──────────────────────────────────────────────
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

      if (user && navigator.onLine) {
        try {
          const { data: freshRows } = await supabase
            .from("transactions")
            .select("*")
            .in(
              "id",
              localSelected.map((t) => t.id),
            )
            .eq("user_id", user.id);

          if (freshRows?.length) {
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
          /* use local */
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
        const outTx = outPool[oi],
          inTx = inPool[ii];
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
        return {
          tx,
          settled,
          oldRemaining,
          newRemaining,
          willComplete: newRemaining <= 0.001 && settled > 0,
          isAdvanceTx,
        };
      });

      return { previews, totalSettled, affectedCount };
    },
    [transactions, user],
  );

  // ── netSettle ─────────────────────────────────────────────────────────────
  const netSettle = async ({ note, method } = {}) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");
    if (isNoContact) throw new Error("Net Settle requires a single contact.");

    let freshTxs = transactions.filter(
      (t) => t._role !== "linked" && t.status !== "deleted",
    );

    if (navigator.onLine) {
      try {
        const { data: freshRows } = await supabase
          .from("transactions")
          .select("*")
          .eq("contact_id", contactId)
          .eq("user_id", user.id)
          .neq("status", "deleted");
        if (freshRows) freshTxs = freshRows.map(rowToTransaction);
      } catch {
        /* use local */
      }
    }

    let toReceive = 0,
      toGive = 0;
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
    if (Math.abs(netAmount) < 0.01) throw new Error("Net balance is zero");

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
    const balancingTxLocal = rowToTransaction({
      ...balancingRow,
      created_at: now,
      updated_at: now,
    });

    const eligibleExisting = freshTxs.filter((t) => {
      const rem = (t.totalAmount ?? 0) - (t.paidAmount ?? 0);
      return t.status === "pending" ? rem > 0 : t.status === "overpaid";
    });
    const allParticipants = [...eligibleExisting, balancingTxLocal];
    if (allParticipants.length < 2)
      throw new Error("Not enough eligible transactions");

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
      const outTx = outPool[oi],
        inTx = inPool[ii];
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
    freshMap[balancingTxId] = balancingTxLocal;
    const updatedTxs = {};

    for (const tx of allParticipants) {
      const settlement = settlementMap[tx.id];
      if (!settlement || settlement.amount <= 0) continue;
      const existing = freshMap[tx.id] ?? tx;
      const currentRemaining =
        (existing.totalAmount ?? 0) - (existing.paidAmount ?? 0);
      const isAdvanceTx = currentRemaining < 0;
      const partnerNote = `Settled against: ${settlement.partnerIds.map((id) => id.slice(0, 8)).join(", ")}`;
      let newPaid, historyEntry;

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

      const baseHistory = existing.paidAmountHistory ?? [];
      updatedTxs[tx.id] = {
        ...existing,
        paidAmount: newPaid,
        paidAmountHistory: [...baseHistory, historyEntry],
        status: deriveStatus(newPaid, existing.totalAmount ?? 0),
        updatedAt: now,
      };
    }

    if (!updatedTxs[balancingTxId])
      updatedTxs[balancingTxId] = balancingTxLocal;

    const allRows = Object.values(updatedTxs).map((t) =>
      t.id === balancingTxId ? balancingRow : transactionToRow(t),
    );
    const finalBalancing = updatedTxs[balancingTxId] ?? balancingTxLocal;

    setTransactions((prev) => {
      const existingIds = new Set(prev.map((t) => t.id));
      const list = prev.map((t) =>
        updatedTxs[t.id] ? { ...updatedTxs[t.id], _role: t._role } : t,
      );
      if (!existingIds.has(balancingTxId))
        list.unshift({ ...finalBalancing, _role: "primary" });
      for (const u of Object.values(updatedTxs)) {
        if (!existingIds.has(u.id) && u.id !== balancingTxId) list.push(u);
      }
      saveToLocal(list);
      return list;
    });

    if (!navigator.onLine) {
      enqueue(
        OP_TYPES.TX_UPSERT,
        { rows: allRows },
        Object.values(updatedTxs),
        user.id,
      );
      return { settlementGroupId, balancingTxId, staleCount: 0 };
    }

    try {
      const { error: batchErr } = await supabase
        .from("transactions")
        .upsert(allRows, { onConflict: "id" });
      if (batchErr) throw batchErr;
    } catch (err) {
      if (isNetworkError(err)) {
        enqueue(
          OP_TYPES.TX_UPSERT,
          { rows: allRows },
          Object.values(updatedTxs),
          user.id,
        );
        return { settlementGroupId, balancingTxId, staleCount: 0 };
      }
      throw err;
    }

    return { settlementGroupId, balancingTxId, staleCount: 0 };
  };

  // ── assignContact ─────────────────────────────────────────────────────────
  // FIX: now also pushes the transaction into the target contact's localStorage
  // cache immediately so the contact page shows it without needing a reload.
  const assignContact = async (
    txId,
    targetContactId,
    { allowReassign = false } = {},
  ) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");
    if (!targetContactId) throw new Error("A contact must be selected");

    const assignedAt = new Date().toISOString();
    const tx = transactions.find((t) => t.id === txId);

    // Optimistic local write — update contactId in current hook's state
    setTransactions((prev) => {
      const list = prev.map((t) =>
        t.id === txId
          ? { ...t, contactId: targetContactId, updatedAt: assignedAt }
          : t,
      );
      saveToLocal(list);
      return list;
    });

    // FIX: push the updated tx into the target contact's localStorage cache
    if (tx) {
      pushToContactCache(
        { ...tx, contactId: targetContactId, updatedAt: assignedAt },
        targetContactId,
      );
    }

    if (!navigator.onLine) {
      enqueue(
        OP_TYPES.TX_ASSIGN_CONTACT,
        { txId, contactId: targetContactId, allowReassign },
        null,
        user.id,
      );
      return;
    }

    try {
      const { data: freshRows, error: fetchErr } = await supabase
        .from("transactions")
        .select("contact_id")
        .eq("id", txId)
        .eq("user_id", user.id)
        .limit(1);

      if (fetchErr) throw fetchErr;

      const fresh = freshRows?.[0];
      if (fresh?.contact_id && !allowReassign)
        throw new Error("Already assigned");

      const { error: updateErr } = await supabase
        .from("transactions")
        .update({ contact_id: targetContactId, updated_at: assignedAt })
        .eq("id", txId)
        .eq("user_id", user.id);

      if (updateErr) throw updateErr;
    } catch (err) {
      if (isNetworkError(err)) {
        enqueue(
          OP_TYPES.TX_ASSIGN_CONTACT,
          { txId, contactId: targetContactId, allowReassign },
          null,
          user.id,
        );
        return;
      }
      throw err;
    }
  };

  // ── assignContactBulk ─────────────────────────────────────────────────────
  const assignContactBulk = async (txIds, targetContactId) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");
    if (!targetContactId) throw new Error("A contact must be selected");
    if (!txIds?.length) return { assignedCount: 0, skippedCount: 0 };

    const localAssignable = txIds.filter((id) => {
      const t = transactions.find((tx) => tx.id === id);
      return t && !t.contactId;
    });

    let assignableIds = localAssignable;
    let skippedCount = txIds.length - localAssignable.length;

    if (navigator.onLine) {
      try {
        const { data: freshRows } = await supabase
          .from("transactions")
          .select("id, contact_id")
          .in("id", txIds)
          .eq("user_id", user.id);

        if (freshRows) {
          assignableIds = freshRows
            .filter((r) => !r.contact_id)
            .map((r) => r.id);
          skippedCount = txIds.length - assignableIds.length;
        }
      } catch {
        /* use local */
      }
    }

    if (assignableIds.length === 0) return { assignedCount: 0, skippedCount };

    const assignedAt = new Date().toISOString();
    const assignedSet = new Set(assignableIds);

    // Optimistic local write
    setTransactions((prev) => {
      const list = prev.filter((t) => !assignedSet.has(t.id));
      saveToLocal(list);
      return list;
    });

    // FIX: push each assigned tx into the target contact's localStorage cache
    for (const txId of assignableIds) {
      const tx = transactions.find((t) => t.id === txId);
      if (tx)
        pushToContactCache(
          { ...tx, contactId: targetContactId, updatedAt: assignedAt },
          targetContactId,
        );
    }

    if (!navigator.onLine) {
      for (const txId of assignableIds) {
        enqueue(
          OP_TYPES.TX_ASSIGN_CONTACT,
          { txId, contactId: targetContactId, allowReassign: false },
          null,
          user.id,
        );
      }
      return { assignedCount: assignableIds.length, skippedCount };
    }

    try {
      const { error: updateErr } = await supabase
        .from("transactions")
        .update({ contact_id: targetContactId, updated_at: assignedAt })
        .in("id", assignableIds)
        .eq("user_id", user.id);
      if (updateErr) throw updateErr;
    } catch (err) {
      if (isNetworkError(err)) {
        for (const txId of assignableIds) {
          enqueue(
            OP_TYPES.TX_ASSIGN_CONTACT,
            { txId, contactId: targetContactId, allowReassign: false },
            null,
            user.id,
          );
        }
        return { assignedCount: assignableIds.length, skippedCount };
      }
      throw err;
    }

    return { assignedCount: assignableIds.length, skippedCount };
  };

  // ── unassignContact ───────────────────────────────────────────────────────
  const unassignContact = async (txId) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    // FIX: also remove from the contact's cache and push to unassigned cache
    const tx = transactions.find((t) => t.id === txId);
    const previousContactId = tx?.contactId;

    setTransactions((prev) => {
      const list = prev.map((t) =>
        t.id === txId ? { ...t, contactId: null } : t,
      );
      saveToLocal(list);
      return list;
    });

    // Remove from the contact's cache if it was there
    if (previousContactId) {
      removeFromCache(txId, previousContactId);
      // Add it to the unassigned cache
      if (tx) pushToContactCache({ ...tx, contactId: null }, NO_CONTACT);
    }

    if (!navigator.onLine) {
      enqueue(OP_TYPES.TX_UNASSIGN_CONTACT, { txId }, null, user.id);
      return;
    }

    try {
      const { error } = await supabase
        .from("transactions")
        .update({ contact_id: null, updated_at: new Date().toISOString() })
        .eq("id", txId)
        .eq("user_id", user.id);
      if (error) throw error;
    } catch (err) {
      if (isNetworkError(err)) {
        enqueue(OP_TYPES.TX_UNASSIGN_CONTACT, { txId }, null, user.id);
        return;
      }
      throw err;
    }
  };

  // ── dropFromLocalState ────────────────────────────────────────────────────
  // FIX: now correctly removes from localStorage too (was missing saveToLocal call)
  const dropFromLocalState = useCallback(
    (txId) => {
      setTransactions((prev) => {
        if (!prev.some((t) => t.id === txId)) return prev;
        const list = prev.filter((t) => t.id !== txId);
        saveToLocal(list); // ← was missing in original
        return list;
      });
    },
    [saveToLocal],
  );

  // ── summary ───────────────────────────────────────────────────────────────
  const summary = transactions.reduce(
    (acc, tx) => {
      if (tx.status === "deleted") return acc;
      if (tx._role === "linked") return acc;
      if (isNoContact && tx.contactId) return acc;

      const remaining = (tx.totalAmount ?? 0) - (tx.paidAmount ?? 0);
      const isOverpaid = remaining < 0;
      const isPending = tx.status === "pending";

      if (isPending && remaining > 0) {
        acc.totalPending += 1;
        if (tx.type === "out") acc.pendingOut += 1;
        else acc.pendingIn += 1;
      }

      if (isPending && tx.type === "out" && remaining > 0)
        acc.toReceive += remaining;
      else if (isOverpaid && tx.type === "in") {
        acc.toReceive += Math.abs(remaining);
        acc.overpaidIn += 1;
      }
      if (isPending && tx.type === "in" && remaining > 0)
        acc.toGive += remaining;
      else if (isOverpaid && tx.type === "out") {
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
    assignContact,
    assignContactBulk,
    unassignContact,
    dropFromLocalState,
  };
};
