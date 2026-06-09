import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

// Module-level — stable across renders, safe to use inside useEffect closures.
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

// Derive status from paid vs total amounts.
// FIX #1: A transaction with totalAmount === 0 should stay "pending" — it has
// nothing to ever settle against. This function intentionally returns "pending"
// for zero-total transactions. The UI blocks creation of zero-total item
// transactions; zero-total financials are blocked at the Details step.
// The only remaining zero-total case is a soft-deleted partner whose total was
// not our concern, so "pending" is the safest fallback there too.
// NOTE: "deleted" status is never set here — it is only set explicitly by
// deleteTransaction, which skips deriveStatus entirely for the target tx.
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

  // FIX #6: Track both contactId AND user.id so hasFetched resets when either
  // changes. Without the user guard, switching accounts without a page reload
  // would skip the fetch and show the previous user's cached data.
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

  // FIX #6: Reset hasFetched when contactId OR user changes so navigating
  // between contacts, or switching accounts, always triggers a fresh DB fetch.
  useEffect(() => {
    if (!contactId) return;
    const currentUserId = user?.id ?? null;
    if (hasFetched.current && currentUserId !== prevUserIdRef.current) {
      // User changed — force a re-fetch.
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

    setTransactions((prev) => {
      const updated = [tx, ...prev];
      saveToLocal(updated);
      return updated;
    });
    return tx;
  };

  // FIX #2: Fetch a fresh DB row before writing so a concurrent addPayment
  // (or any other update) that landed between the state read and this upsert
  // is not silently overwritten in the database.
  //
  // IMPORTANT: `updates` must never contain paidAmount or paidAmountHistory.
  // Those fields are owned by addPayment/settleTransactions and must always
  // be sourced from the fresh DB row. TransactionDetailModal.handleSave is
  // the only caller and intentionally omits payment fields from its updates
  // object for exactly this reason.
  const updateTransaction = async (txId, updates) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    // Fetch the authoritative row from DB before building the upsert payload.
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

    // Merge: structural edits from `updates`, payment fields always from the
    // fresh DB row. This means a payment recorded between edit-open and save
    // is never overwritten.
    const merged = {
      ...existing,
      ...updates,
      // Explicitly preserve payment fields from fresh DB — reject any that
      // may have accidentally been included in updates.
      paidAmount: existing.paidAmount,
      paidAmountHistory: existing.paidAmountHistory,
      id: txId,
      updatedAt: new Date().toISOString(),
    };

    // Re-derive status using the authoritative paid amount and the (possibly
    // updated) total amount from updates.
    const newTotal = parseFloat(merged.totalAmount) || 0;
    merged.status = deriveStatus(merged.paidAmount, newTotal);

    const row = transactionToRow(merged);
    const { error: err } = await supabase
      .from("transactions")
      .upsert([row], { onConflict: "id" });

    if (err) throw err;

    // Functional setState: always merges on top of latest local state so the
    // UI reflects the write immediately and any concurrent local-only changes
    // (e.g. an addPayment that already updated state) are not rolled back.
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

  // ── deleteTransaction ─────────────────────────────────────────────────────
  //
  // Soft-delete: marks status as "deleted" in DB instead of removing the row.
  // Then finds every transaction that was linked to this one via a settlement
  // (by scanning paidAmountHistory for entries referencing txId in partnerIds),
  // strips those settlement entries from their history, recomputes paidAmount
  // from scratch from remaining non-reversed entries, and re-derives status.
  //
  // This effectively "undoes" the settlement contributions of the deleted tx
  // across all its partners, leaving them in the correct state as if the
  // settlement had never included the deleted transaction.
  //
  const deleteTransaction = async (txId) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    const now = new Date().toISOString();

    // FIX #3: Fetch the target tx fresh from DB (not from stale local state)
    // so any payment recorded on another device since the page loaded is not
    // silently dropped from the audit history of the soft-deleted record.
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

    // 2. Identify partner IDs: transactions that have a settlement entry
    //    referencing the deleted tx in their partnerIds.
    //
    //    The old approach scanned only local state, which misses partners
    //    whose settlement was recorded on another device after this page loaded.
    //    We now query the DB directly: fetch all non-deleted transactions for
    //    this contact, then filter client-side for ones whose
    //    paid_amount_history contains an entry with txId in partnerIds.
    //    The result set is small (one contact's transactions) so this is fine.
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

    // 3. Extract authoritative partner rows from the contact fetch we already
    //    did above — no second round-trip needed.
    const freshPartners =
      partnerIds.length > 0
        ? allContactTxRows
            .filter((row) => partnerIds.includes(row.id))
            .map(rowToTransaction)
        : [];

    // 4. For each partner, surgically remove only the deleted tx's contribution
    //    from their settlement history.
    //
    //    Data shape (after the settleTransactions fix above):
    //      A's entry: { amount:1000, partnerIds:[B,C], partnerAmounts:{B:600,C:400} }
    //      B's entry: { amount:600,  partnerIds:[A],   partnerAmounts:{A:600} }
    //      C's entry: { amount:400,  partnerIds:[A],   partnerAmounts:{A:400} }
    //
    //    Deleting B: find A via step 2. Clean A's entry:
    //      • partnerAmounts[B] = 600 → subtract 600 from entry.amount → 400
    //      • remove B from partnerIds → [C]
    //      • remove B from partnerAmounts → {C:400}
    //      • amount > 0 → keep entry with updated values
    //    Result: A.paidAmount recomputed from history = 400 → status pending ✓
    //
    //    Backwards-compatibility: older entries may not have partnerAmounts.
    //    Fall back to removing the entry entirely in that case (old behaviour,
    //    which is only wrong for multi-party settlements — acceptable for data
    //    written before this fix).
    //
    //    advance-applied entries carry negative amounts; do NOT clamp to 0.
    const updatedPartners = freshPartners.map((partner) => {
      const cleanedHistory = (partner.paidAmountHistory ?? [])
        .map((entry) => {
          const isSettlementEntry =
            entry.method === "settlement" || entry.method === "advance-applied";
          if (!isSettlementEntry) return entry;

          const refsDeletedTx = (entry.partnerIds ?? []).includes(txId);
          if (!refsDeletedTx) return entry;

          // How much did the deleted tx contribute to this entry?
          const contribution =
            entry.partnerAmounts != null
              ? (entry.partnerAmounts[txId] ?? 0)
              : Math.abs(entry.amount); // fallback: assume it was the sole contributor

          const remainingPartners = (entry.partnerIds ?? []).filter(
            (pid) => pid !== txId,
          );

          // Compute the new amount after removing the deleted tx's share.
          // For advance-applied entries amount is negative; preserve the sign.
          const sign = entry.amount < 0 ? -1 : 1;
          const newAbsAmount = Math.abs(entry.amount) - contribution;

          if (remainingPartners.length === 0 || newAbsAmount <= 0.001) {
            // No remaining partners or nothing left → drop the entry entirely.
            return null;
          }

          // Build updated partnerAmounts without the deleted tx.
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

    // 5. Persist all changes sequentially so a failure on any write stops
    //    before the remaining writes fire, keeping the DB consistent.
    //    Write the soft-deleted target first, then each partner reversal.
    //    If any write fails the error bubbles up and the state update below
    //    is skipped, leaving local state unchanged until the next page load
    //    re-fetches from DB.
    const allToWrite = [deletedTx, ...updatedPartners];
    for (const record of allToWrite) {
      const { error: err } = await supabase
        .from("transactions")
        .upsert([transactionToRow(record)], { onConflict: "id" });
      if (err) throw err;
    }

    // 6. Single atomic state update.
    // Partners found via the DB scan may not be in local state (if they were
    // added on another device). Upsert them into the local list so the UI
    // immediately reflects the reversal.
    setTransactions((prev) => {
      const partnerMap = Object.fromEntries(
        updatedPartners.map((p) => [p.id, p]),
      );
      const existingIds = new Set(prev.map((t) => t.id));
      // Update existing rows
      const newList = prev.map((t) => {
        if (t.id === txId) return deletedTx;
        if (partnerMap[t.id]) return partnerMap[t.id];
        return t;
      });
      // Append any partners that only existed in DB, not in local state
      for (const partner of updatedPartners) {
        if (!existingIds.has(partner.id)) newList.push(partner);
      }
      saveToLocal(newList);
      return newList;
    });
  };

  // ── addPayment ────────────────────────────────────────────────────────────
  //
  // Fetches a fresh DB row before writing so that a payment recorded in
  // another session between this call being triggered and the write landing
  // is not silently overwritten. The functional setState below additionally
  // ensures the in-memory state update is always applied on top of the
  // latest local state.
  //
  const addPayment = async (txId, payment) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    // Fetch the authoritative row from DB so we never base our write on a
    // stale closure snapshot (e.g. another device recorded a payment just
    // before this call fires).
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

    // FIX #4: Replace the entire transaction from the DB-authoritative result
    // rather than adding payment.amount on top of whatever is in local state.
    // The old approach (latestPaid = current.paidAmount + payment.amount) would
    // double-count if two addPayment calls ran concurrently: both DB writes
    // would be correct (each based on its own fresh fetch), but both local
    // updaters would each add payment.amount to the same starting state value,
    // producing a doubled local paidAmount until the next page reload.
    // Replacing with the DB-derived object keeps local state exactly in sync
    // with what was actually written.
    setTransactions((prev) => {
      const newList = prev.map((t) => (t.id === txId ? updatedForDb : t));
      saveToLocal(newList);
      return newList;
    });

    return updatedForDb;
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

    // Pull all selected transactions from local state as the initial candidate set.
    const selected = txIds
      .map((id) => transactions.find((t) => t.id === id))
      .filter(Boolean)
      .filter((t) => {
        if (t.status === "deleted") return false;
        const rem = (t.totalAmount ?? 0) - (t.paidAmount ?? 0);
        if (t.status === "pending") return rem > 0;
        return rem < 0;
      });

    if (selected.length < 2)
      throw new Error("Need at least 2 eligible transactions");

    // Fetch authoritative rows from DB for all selected transactions before
    // computing anything. This prevents stale-snapshot divergence when a
    // payment was recorded on one of these transactions just before settlement
    // fires (e.g. rapid UI actions or a concurrent session).
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

    // Re-filter using fresh DB data: a transaction may have become ineligible
    // (e.g. fully paid) since the user opened the settle modal.
    const freshSelected = selected
      .map((t) => freshMap[t.id] ?? t)
      .filter((t) => {
        if (t.status === "deleted") return false;
        const rem = (t.totalAmount ?? 0) - (t.paidAmount ?? 0);
        if (t.status === "pending") return rem > 0;
        return rem < 0;
      });

    // Track how many transactions were dropped by the fresh re-filter so the
    // caller can surface a warning to the user when the result differs from
    // what was shown in the preview.
    const staleCount = selected.length - freshSelected.length;

    if (freshSelected.length < 2)
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

    // inPool: sources of "money we owe"
    //   - pending in  (remaining > 0): purchase, we still owe supplier
    //   - overpaid out (remaining < 0): customer overpaid us → we owe customer
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

    // Map of txId → { amount, partnerIds, partnerAmounts }
    // partnerAmounts: { [partnerId]: amount } stores how much each individual
    // partner contributed to this tx's settlement total. This is essential for
    // deleteTransaction to subtract exactly the right share when one partner is
    // later deleted, without disturbing contributions from surviving partners.
    // Example: A settled against B(₹600) + C(₹400):
    //   A: { amount:1000, partnerIds:[B,C], partnerAmounts:{B:600, C:400} }
    //   B: { amount:600,  partnerIds:[A],   partnerAmounts:{A:600} }
    //   C: { amount:400,  partnerIds:[A],   partnerAmounts:{A:400} }
    const settlementMap = {};
    freshSelected.forEach((t) => {
      settlementMap[t.id] = { amount: 0, partnerIds: [], partnerAmounts: {} };
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

    // Build the complete set of updated transaction objects from fresh DB data.
    const updatedTxs = {}; // id → updated transaction object
    const now = new Date().toISOString();

    for (const tx of freshSelected) {
      const settlement = settlementMap[tx.id];
      if (settlement.amount <= 0) continue;

      // Use the fresh DB row, not the closure snapshot.
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
        // Consuming an advance: reduce paidAmount to eliminate the surplus
        // e.g. total=1500, paid=2000, advance=500 → apply 500 → paid becomes 1500
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
        // Normal pending settlement: increase paidAmount
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

    // Push all DB writes sequentially so a failure on any single write
    // stops before the remaining writes fire, avoiding half-settled states
    // that would be impossible to reconcile without a DB transaction.
    for (const updated of Object.values(updatedTxs)) {
      const { error: err } = await supabase
        .from("transactions")
        .upsert([transactionToRow(updated)], { onConflict: "id" });
      if (err) throw err;
    }

    // Single state update — applies all changes atomically so every card
    // and the summary re-render together in one pass.
    // Also appends any settled transactions that exist in the DB but were not
    // in local state (e.g. added on another device), matching the same pattern
    // used in deleteTransaction to keep local state consistent with DB.
    setTransactions((prev) => {
      const existingIds = new Set(prev.map((t) => t.id));
      const newList = prev.map((t) => updatedTxs[t.id] ?? t);
      for (const updated of Object.values(updatedTxs)) {
        if (!existingIds.has(updated.id)) newList.push(updated);
      }
      saveToLocal(newList);
      return newList;
    });

    // Return both the group ID and the stale count so the caller can
    // surface a warning when the actual result differed from the preview.
    return { settlementGroupId, staleCount };
  };

  // ── computeSettlementPreview ──────────────────────────────────────────────
  // Returns a preview of what would happen if the selected txIds are settled.
  // Mirrors the greedy-offset logic in settleTransactions exactly.
  //
  // FIX #5: Preview now fetches fresh DB rows so the displayed numbers match
  // what settleTransactions will actually compute. This eliminates the
  // divergence that occurred when transactions were updated on another device
  // after the page loaded. Because this is now async, the SettleTransactionsModal
  // receives the result via a state variable rather than a useMemo.
  //
  // Wrapped in useCallback so callers can safely use it as a dependency.
  const computeSettlementPreview = useCallback(
    async (txIds) => {
      // Start with local state for the initial candidate set (fast path).
      const localSelected = txIds
        .map((id) => transactions.find((t) => t.id === id))
        .filter(Boolean)
        .filter((t) => {
          if (t.status === "deleted") return false;
          const rem = (t.totalAmount ?? 0) - (t.paidAmount ?? 0);
          if (t.status === "pending") return rem > 0;
          return rem < 0;
        });

      // If we have a user, fetch fresh DB rows so the preview is accurate.
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
          // Fall back to local state on fetch error — preview may be slightly
          // stale but the actual settle will still fetch fresh data.
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

  // ── netSettle ─────────────────────────────────────────────────────────────
  //
  // "One-click net settlement": creates a balancing financial transaction for
  // the net amount and settles it against all pending/overpaid transactions.
  //
  //   net > 0  (we are owed)  → create a pending financial "in" for net amount.
  //                             It opposes all the pending/overpaid "out" txs.
  //
  //   net < 0  (we owe)       → create a pending financial "out" for net amount.
  //                             It opposes all the pending/overpaid "in" txs.
  //
  // IMPORTANT: does NOT call settleTransactions() because that function reads
  // from React state which may not have flushed the newly inserted balancing tx
  // yet. Instead we do everything inline with the fresh DB rows we already hold,
  // mirroring settleTransactions logic exactly.
  //
  const netSettle = async ({ note, method } = {}) => {
    if (!user) throw new Error("NOT_AUTHENTICATED");

    // 1. Fetch all non-deleted transactions fresh from DB.
    const { data: freshRows, error: fetchErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("contact_id", contactId)
      .eq("user_id", user.id)
      .neq("status", "deleted");

    if (fetchErr) throw fetchErr;

    const freshTxs = (freshRows ?? []).map(rowToTransaction);

    // 2. Recompute net from authoritative DB data (same logic as summary).
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

    // 3. Build + insert the balancing financial transaction (pending, paidAmount=0).
    //    net > 0: we are owed → type "in"  (contact pays us)
    //    net < 0: we owe      → type "out" (we pay contact)
    const balancingType = netAmount > 0 ? "in" : "out";
    const balancingAmount = Math.abs(netAmount);
    const now = new Date().toISOString();
    const balancingTxId = crypto.randomUUID();
    const settlementGroupId = crypto.randomUUID();

    const baseNote = `Net settlement via ${method ?? "cash"}`;
    const balancingTxNote = note?.trim()
      ? `${baseNote} · ${note.trim()}`
      : baseNote;

    // Insert with empty paid_amount_history — the settlement entry written
    // below will be the only history record. The payment method is captured
    // in the note so there is no misleading "cash ₹X" line in the history.
    const balancingRow = {
      id: balancingTxId,
      user_id: user.id,
      contact_id: contactId,
      type: balancingType,
      kind: "financial",
      items_list: [],
      additional_amounts: [],
      total_amount: balancingAmount,
      paid_amount: 0, // starts pending; settlement below completes it
      paid_amount_history: [],
      item_list_history: [],
      note: balancingTxNote,
      status: "pending",
    };

    const { error: insertErr } = await supabase
      .from("transactions")
      .insert([balancingRow]);
    if (insertErr) throw insertErr;

    // Build the JS object for use in the settlement logic below.
    const balancingTx = rowToTransaction({
      ...balancingRow,
      created_at: now,
      updated_at: now,
      contact_id: contactId,
    });

    // 4. Build the full set of participants: all eligible existing txs + the
    //    new balancing tx. We work entirely from DB data — no React state reads.
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

    // 5. Build pools — identical logic to settleTransactions.
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

    // 6. Greedy offset — identical to settleTransactions.
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

    // 7. Build updated transaction objects — identical to settleTransactions.
    //    Use a fresh lookup map that includes the balancing tx.
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

    // 8. Write all to DB sequentially.
    for (const updated of Object.values(updatedTxs)) {
      const { error: err } = await supabase
        .from("transactions")
        .upsert([transactionToRow(updated)], { onConflict: "id" });
      if (err) throw err;
    }

    // 9. Single atomic state update — include the balancing tx even if it had
    //    no settlement activity (edge case: zero eligible existing txs).
    const finalBalancing = updatedTxs[balancingTxId] ?? balancingTx;

    setTransactions((prev) => {
      const existingIds = new Set(prev.map((t) => t.id));
      // Apply settlement updates to existing rows.
      const newList = prev.map((t) => updatedTxs[t.id] ?? t);
      // Prepend the balancing tx (always new).
      if (!existingIds.has(balancingTxId)) newList.unshift(finalBalancing);
      // Append any settled txs that were in DB but not local state.
      for (const updated of Object.values(updatedTxs)) {
        if (!existingIds.has(updated.id) && updated.id !== balancingTxId)
          newList.push(updated);
      }
      saveToLocal(newList);
      return newList;
    });

    return { settlementGroupId, balancingTxId, staleCount: 0 };
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
  // Deleted transactions are excluded from all summary calculations.
  //
  const summary = transactions.reduce(
    (acc, tx) => {
      // Deleted transactions contribute nothing to the summary.
      if (tx.status === "deleted") return acc;

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
    netSettle,
  };
};
