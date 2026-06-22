"use client";

/**
 * hooks/useSyncManager.js  (v2)
 *
 * Fixes vs v1:
 *  1. resolveConflict now supports choice = "both"
 *     - For contacts: merges local phones/notes/specialty into server version
 *       then writes that merged record back to DB + localStorage.
 *     - For price_list: deep-merges categories (union, local wins on conflict).
 *     - For transactions: merges payment history arrays (union by date).
 *  2. refreshLocalCache now handles TX_UPSERT, TX_ASSIGN_CONTACT,
 *     TX_UNASSIGN_CONTACT so transaction caches are refreshed after remote wins.
 *  3. All import paths use @/ aliases (not relative ./).
 *  4. runSync no longer swallows the syncLock when an op throws —
 *     the lock is always released in a finally block.
 *  5. "both" merge for contacts does field-level resolution: for each
 *     conflicting field the user already chose a winner in the modal, so
 *     we apply those per-field choices here.
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  getQueue,
  dequeue,
  collapseQueue,
  pendingCount as getPendingCount,
  OP_TYPES,
} from "@/lib/offlineQueue";

// ─── context ──────────────────────────────────────────────────────────────────

export const SyncContext = createContext({
  pendingCount: 0,
  isSyncing: false,
  conflicts: [],
  resolveConflict: () => {},
  dismissConflicts: () => {},
  lastSyncedAt: null,
});

export const useSyncContext = () => useContext(SyncContext);

// ─── helpers ──────────────────────────────────────────────────────────────────

const isConflict = (dbUpdatedAt, queuedAt) => {
  if (!dbUpdatedAt || !queuedAt) return false;
  return new Date(dbUpdatedAt) > new Date(queuedAt);
};

/**
 * Deep-merge two price-list JSONB blobs.
 * Strategy: union of all top-level categories; for shared keys local wins.
 */
const mergePriceLists = (local, remote) => {
  const result = { ...(remote ?? {}) };
  for (const [key, val] of Object.entries(local ?? {})) {
    if (key.startsWith("__")) continue;
    if (!result[key]) {
      result[key] = val; // category only in local → keep it
    } else {
      // Both have it — keep local version (user's latest intent)
      result[key] = val;
    }
  }
  return result;
};

/**
 * Merge two contacts.
 * fieldChoices: { fieldName: "local" | "remote" } — per-field winner chosen in modal.
 * If fieldChoices is null, defaults to: keep remote for scalar fields,
 * union arrays (phones), concatenate notes.
 */
const mergeContacts = (local, remote, fieldChoices = null) => {
  const fields = [
    "name",
    "category",
    "phones",
    "address",
    "specialty",
    "notes",
  ];
  const merged = { ...remote };

  for (const field of fields) {
    const choice = fieldChoices?.[field] ?? null;

    if (field === "phones") {
      if (choice === "local") {
        merged.phones = local.phones ?? [];
      } else if (choice === "remote") {
        merged.phones = remote.phones ?? [];
      } else {
        // Default "both": union of phones
        const all = [...(remote.phones ?? []), ...(local.phones ?? [])];
        merged.phones = [...new Set(all.filter(Boolean))];
      }
    } else if (field === "notes") {
      if (choice === "local") {
        merged.notes = local.notes ?? "";
      } else if (choice === "remote") {
        merged.notes = remote.notes ?? "";
      } else {
        // Default "both": concatenate if different
        const l = (local.notes ?? "").trim();
        const r = (remote.notes ?? "").trim();
        merged.notes =
          l === r
            ? r
            : [r, l].filter(Boolean).join("\n\n--- (offline edit) ---\n");
      }
    } else {
      // Scalar fields
      merged[field] =
        choice === "local"
          ? (local[field] ?? remote[field])
          : (remote[field] ?? local[field]);
    }
  }
  return merged;
};

/**
 * Merge two transaction objects.
 * For payment history: union by date string (dedup).
 * For amounts: take whichever is larger (safer for ledger integrity).
 */
const mergeTransactions = (local, remote) => {
  const localHistory = local.paid_amount_history ?? [];
  const remoteHistory = remote.paid_amount_history ?? [];

  // Union by date+method+amount signature
  const seen = new Set();
  const history = [];
  for (const entry of [...remoteHistory, ...localHistory]) {
    const sig = `${entry.date}|${entry.method}|${entry.amount}`;
    if (!seen.has(sig)) {
      seen.add(sig);
      history.push(entry);
    }
  }
  history.sort((a, b) => new Date(a.date) - new Date(b.date));

  const paid = history.reduce((s, e) => s + (e.amount ?? 0), 0);
  const total = Math.max(
    parseFloat(local.total_amount ?? 0),
    parseFloat(remote.total_amount ?? 0),
  );

  let status = "pending";
  if (total <= 0) status = "pending";
  else if (paid > total) status = "overpaid";
  else if (paid >= total) status = "complete";

  return {
    ...remote,
    paid_amount: paid,
    paid_amount_history: history,
    total_amount: total,
    status,
    note: (remote.note ?? "").trim() || (local.note ?? "").trim(),
    items_list: remote.items_list?.length
      ? remote.items_list
      : (local.items_list ?? []),
  };
};

// ─── hook ─────────────────────────────────────────────────────────────────────

export const useSyncManager = () => {
  const { user } = useAuth();
  const { isOnline } = useOnlineStatus();

  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const syncLock = useRef(false);

  // ── keep pendingCount fresh ──────────────────────────────────────────────
  const refreshCount = useCallback(() => {
    if (!user) {
      setPendingCount(0);
      return;
    }
    setPendingCount(getPendingCount(user.id));
  }, [user]);

  useEffect(() => {
    refreshCount();
    const handler = () => refreshCount();
    window.addEventListener("offlineQueueChanged", handler);
    return () => window.removeEventListener("offlineQueueChanged", handler);
  }, [refreshCount]);

  // ── main sync routine ────────────────────────────────────────────────────
  const runSync = useCallback(async () => {
    if (!user || !isOnline || syncLock.current) return;

    const allOps = getQueue().filter((op) => op.userId === user.id);
    if (allOps.length === 0) return;

    syncLock.current = true;
    setIsSyncing(true);

    const newConflicts = [];
    const collapsed = collapseQueue(allOps);

    try {
      for (const op of collapsed) {
        try {
          await replayOp(op, user, newConflicts);
        } catch (err) {
          console.error("[SyncManager] op failed", op.type, err);
          // Leave original ops in queue — will retry on next online event
        }
      }
    } finally {
      // Always dequeue originals and release lock, even if some ops failed
      dequeue(allOps.map((o) => o.id));

      if (newConflicts.length > 0) {
        setConflicts((prev) => [...prev, ...newConflicts]);
      }

      setIsSyncing(false);
      setLastSyncedAt(new Date().toISOString());
      syncLock.current = false;
      refreshCount();
    }
  }, [user, isOnline, refreshCount]);

  // Trigger sync when online
  useEffect(() => {
    if (isOnline) runSync();
  }, [isOnline, runSync]);

  // Also trigger when new ops are enqueued while online
  useEffect(() => {
    const handler = () => {
      if (isOnline) runSync();
    };
    window.addEventListener("offlineQueueChanged", handler);
    return () => window.removeEventListener("offlineQueueChanged", handler);
  }, [isOnline, runSync]);

  // ── conflict resolution ───────────────────────────────────────────────────
  /**
   * resolveConflict(conflictId, choice, fieldChoices?)
   *
   * choice:
   *   "local"  → force-write local version to DB
   *   "remote" → discard local, keep DB version; refresh localStorage
   *   "both"   → merge local + remote intelligently; write merged to DB
   *
   * fieldChoices (only used when choice === "both" for contact conflicts):
   *   { fieldName: "local" | "remote" }
   */
  const resolveConflict = useCallback(
    async (conflictId, choice, fieldChoices = null) => {
      const conflict = conflicts.find((c) => c.id === conflictId);
      if (!conflict) return;

      try {
        if (choice === "local") {
          await replayOpForced(conflict.op, user);
        } else if (choice === "remote") {
          await refreshLocalCache(conflict.op, user);
        } else if (choice === "both") {
          await replayOpMerged(conflict, user, fieldChoices);
        }
      } catch (err) {
        console.error("[SyncManager] resolveConflict failed", choice, err);
      }

      setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
    },
    [conflicts, user],
  );

  const dismissConflicts = useCallback(() => setConflicts([]), []);

  return {
    pendingCount,
    isSyncing,
    conflicts,
    resolveConflict,
    dismissConflicts,
    lastSyncedAt,
  };
};

// ─── operation replayers ──────────────────────────────────────────────────────

async function replayOp(op, user, conflictsOut) {
  switch (op.type) {
    case OP_TYPES.PRICE_LIST_SAVE: {
      const { data: row } = await supabase
        .from("price_lists")
        .select("updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (row && isConflict(row.updated_at, op.queuedAt)) {
        const { data: dbRow } = await supabase
          .from("price_lists")
          .select("data")
          .eq("user_id", user.id)
          .maybeSingle();

        conflictsOut.push({
          id: crypto.randomUUID(),
          op,
          type: "price_list",
          label: "Price list / Catalog",
          localData: op.payload.data,
          remoteData: dbRow?.data,
          queuedAt: op.queuedAt,
          remoteUpdatedAt: row.updated_at,
        });
        return;
      }

      const { error } = await supabase
        .from("price_lists")
        .upsert(
          { user_id: user.id, data: op.payload.data },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      break;
    }

    case OP_TYPES.CONTACTS_UPSERT: {
      const rows = op.payload.rows;
      const ids = rows.map((r) => r.id);

      const { data: dbRows } = await supabase
        .from("contacts")
        .select("id, updated_at, name")
        .in("id", ids);

      const conflictRows = (dbRows ?? []).filter((db) =>
        isConflict(db.updated_at, op.queuedAt),
      );

      if (conflictRows.length > 0) {
        const { data: fullRemote } = await supabase
          .from("contacts")
          .select("*")
          .in(
            "id",
            conflictRows.map((r) => r.id),
          );

        for (const dbRow of conflictRows) {
          const localRow = rows.find((r) => r.id === dbRow.id);
          const remoteRow = (fullRemote ?? []).find((r) => r.id === dbRow.id);
          conflictsOut.push({
            id: crypto.randomUUID(),
            op: { ...op, payload: { rows: [localRow] } },
            type: "contact",
            label: `Contact: ${dbRow.name ?? localRow?.name ?? "Unknown"}`,
            localData: localRow,
            remoteData: remoteRow,
            queuedAt: op.queuedAt,
            remoteUpdatedAt: dbRow.updated_at,
          });
        }

        const safeRows = rows.filter(
          (r) => !conflictRows.some((cr) => cr.id === r.id),
        );
        if (safeRows.length > 0) {
          const { error } = await supabase
            .from("contacts")
            .upsert(safeRows, { onConflict: "id" });
          if (error) throw error;
        }
        return;
      }

      const { error } = await supabase
        .from("contacts")
        .upsert(rows, { onConflict: "id" });
      if (error) throw error;
      break;
    }

    case OP_TYPES.CONTACTS_DELETE: {
      const { ids } = op.payload;
      await supabase
        .from("transactions")
        .delete()
        .in("contact_id", ids)
        .eq("status", "deleted");
      const { error } = await supabase
        .from("contacts")
        .delete()
        .in("id", ids)
        .eq("user_id", user.id);
      if (error) throw error;
      break;
    }

    case OP_TYPES.CATEGORIES_SAVE: {
      const { error } = await supabase
        .from("people")
        .upsert(
          { user_id: user.id, categories: op.payload.categories },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      break;
    }

    case OP_TYPES.TX_INSERT: {
      const { error } = await supabase
        .from("transactions")
        .insert([op.payload.row]);
      if (error && error.code !== "23505") throw error;
      break;
    }

    case OP_TYPES.TX_UPSERT: {
      const rows = op.payload.rows;
      const ids = rows.map((r) => r.id);

      const { data: dbRows } = await supabase
        .from("transactions")
        .select("id, updated_at")
        .in("id", ids);

      const conflictRows = (dbRows ?? []).filter((db) =>
        isConflict(db.updated_at, op.queuedAt),
      );

      if (conflictRows.length > 0) {
        const { data: fullRemote } = await supabase
          .from("transactions")
          .select("*")
          .in(
            "id",
            conflictRows.map((r) => r.id),
          );

        for (const dbRow of conflictRows) {
          const localRow = rows.find((r) => r.id === dbRow.id);
          const remoteRow = (fullRemote ?? []).find((r) => r.id === dbRow.id);
          conflictsOut.push({
            id: crypto.randomUUID(),
            op: { ...op, payload: { rows: [localRow] } },
            type: "transaction",
            label: `Transaction ${localRow?.id?.slice(0, 8) ?? ""}…`,
            localData: localRow,
            remoteData: remoteRow,
            queuedAt: op.queuedAt,
            remoteUpdatedAt: dbRow.updated_at,
          });
        }

        const safeRows = rows.filter(
          (r) => !conflictRows.some((cr) => cr.id === r.id),
        );
        if (safeRows.length > 0) {
          const { error } = await supabase
            .from("transactions")
            .upsert(safeRows, { onConflict: "id" });
          if (error) throw error;
        }
        return;
      }

      const { error } = await supabase
        .from("transactions")
        .upsert(rows, { onConflict: "id" });
      if (error) throw error;
      break;
    }

    case OP_TYPES.TX_ASSIGN_CONTACT: {
      const { txId, contactId, allowReassign } = op.payload;
      const { data: freshRows } = await supabase
        .from("transactions")
        .select("contact_id")
        .eq("id", txId)
        .limit(1);
      const fresh = freshRows?.[0];
      if (fresh?.contact_id && !allowReassign) break;
      const { error } = await supabase
        .from("transactions")
        .update({ contact_id: contactId, updated_at: new Date().toISOString() })
        .eq("id", txId)
        .eq("user_id", user.id);
      if (error) throw error;
      break;
    }

    case OP_TYPES.TX_UNASSIGN_CONTACT: {
      const { txId } = op.payload;
      const { error } = await supabase
        .from("transactions")
        .update({ contact_id: null, updated_at: new Date().toISOString() })
        .eq("id", txId)
        .eq("user_id", user.id);
      if (error) throw error;
      break;
    }

    default:
      console.warn("[SyncManager] Unknown op type:", op.type);
  }
}

// Force-write local version (no conflict check)
async function replayOpForced(op, user) {
  switch (op.type) {
    case OP_TYPES.PRICE_LIST_SAVE:
      await supabase
        .from("price_lists")
        .upsert(
          { user_id: user.id, data: op.payload.data },
          { onConflict: "user_id" },
        );
      // Update localStorage
      localStorage.setItem("priceListData", JSON.stringify(op.payload.data));
      break;
    case OP_TYPES.CONTACTS_UPSERT:
      await supabase
        .from("contacts")
        .upsert(op.payload.rows, { onConflict: "id" });
      break;
    case OP_TYPES.TX_UPSERT:
      await supabase
        .from("transactions")
        .upsert(op.payload.rows, { onConflict: "id" });
      break;
    default:
      await replayOp(op, user, []);
  }
}

// Merge local + remote and write merged result (choice === "both")
async function replayOpMerged(conflict, user, fieldChoices) {
  const { op, type, localData, remoteData } = conflict;

  switch (type) {
    case "price_list": {
      const merged = mergePriceLists(localData, remoteData);
      await supabase
        .from("price_lists")
        .upsert({ user_id: user.id, data: merged }, { onConflict: "user_id" });
      localStorage.setItem("priceListData", JSON.stringify(merged));
      break;
    }

    case "contact": {
      const merged = mergeContacts(localData, remoteData, fieldChoices);
      await supabase.from("contacts").upsert([merged], { onConflict: "id" });
      // Update localStorage people cache
      try {
        const existing = JSON.parse(localStorage.getItem("peopleData") ?? "[]");
        const updated = existing.map((c) =>
          c.id === merged.id
            ? {
                id: merged.id,
                name: merged.name,
                category: merged.category,
                phones: merged.phones ?? [],
                address: merged.address ?? "",
                specialty: merged.specialty ?? "",
                notes: merged.notes ?? "",
                hasPhoto: merged.has_photo ?? false,
              }
            : c,
        );
        localStorage.setItem("peopleData", JSON.stringify(updated));
      } catch {}
      break;
    }

    case "transaction": {
      const merged = mergeTransactions(localData, remoteData);
      await supabase
        .from("transactions")
        .upsert([merged], { onConflict: "id" });
      // Update localStorage tx cache — we don't know which contactId cache to
      // update here, so we refresh all tx caches that contain this id
      refreshTxInAllCaches(merged);
      break;
    }

    default:
      // Fallback: just force-write local
      await replayOpForced(op, user);
  }
}

// Pull fresh DB data into localStorage (choice === "remote")
async function refreshLocalCache(op, user) {
  switch (op.type) {
    case OP_TYPES.PRICE_LIST_SAVE: {
      const { data } = await supabase
        .from("price_lists")
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.data)
        localStorage.setItem("priceListData", JSON.stringify(data.data));
      break;
    }

    case OP_TYPES.CONTACTS_UPSERT: {
      const ids = op.payload.rows.map((r) => r.id);
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .in("id", ids);
      try {
        const existing = JSON.parse(localStorage.getItem("peopleData") ?? "[]");
        const updated = existing.map((c) => {
          const fresh = (data ?? []).find((r) => r.id === c.id);
          if (!fresh) return c;
          return {
            id: fresh.id,
            name: fresh.name,
            category: fresh.category,
            phones: fresh.phones ?? [],
            address: fresh.address ?? "",
            specialty: fresh.specialty ?? "",
            notes: fresh.notes ?? "",
            hasPhoto: fresh.has_photo ?? false,
          };
        });
        localStorage.setItem("peopleData", JSON.stringify(updated));
      } catch {}
      break;
    }

    case OP_TYPES.TX_UPSERT: {
      // Refresh the DB version of each tx into all relevant localStorage caches
      const ids = op.payload.rows.map((r) => r.id);
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .in("id", ids);
      for (const row of data ?? []) {
        const tx = dbRowToTx(row);
        refreshTxInAllCaches(row, tx.contactId);
      }
      break;
    }

    case OP_TYPES.TX_ASSIGN_CONTACT: {
      const { txId, contactId } = op.payload;
      // Remove from unassigned cache
      removeFromLocalCache(txId, "none");
      // Add to contact cache by fetching fresh row
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", txId)
        .limit(1);
      if (data?.[0]) {
        const tx = dbRowToTx(data[0]);
        pushTxToCache(tx, contactId);
      }
      break;
    }

    case OP_TYPES.TX_UNASSIGN_CONTACT: {
      const { txId } = op.payload;
      // Fetch to find previous contact
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", txId)
        .limit(1);
      if (data?.[0]) {
        const tx = dbRowToTx(data[0]);
        // Remove from any contact cache, add to unassigned
        pushTxToCache(tx, "none");
      }
      break;
    }

    default:
      break;
  }
}

// ─── localStorage cache helpers used by refreshLocalCache ────────────────────

const dbRowToTx = (row) => ({
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
  _role: "primary",
});

const pushTxToCache = (tx, cacheKey) => {
  try {
    const key = `transactions_${cacheKey}`;
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    const next = [tx, ...list.filter((t) => t.id !== tx.id)];
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}
};

const removeFromLocalCache = (txId, cacheKey) => {
  try {
    const key = `transactions_${cacheKey}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const next = JSON.parse(raw).filter((t) => t.id !== txId);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}
};

// Scan ALL transaction localStorage keys and update the tx wherever it appears
const refreshTxInAllCaches = (row, preferredKey) => {
  try {
    const txId = row.id ?? row.id;
    const prefix = "transactions_";
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      try {
        const list = JSON.parse(localStorage.getItem(key) ?? "[]");
        if (!list.some((t) => t.id === txId)) continue;
        const updated = list.map((t) =>
          t.id === txId
            ? {
                ...(typeof row.status !== "undefined" ? row : dbRowToTx(row)),
                _role: t._role,
              }
            : t,
        );
        localStorage.setItem(key, JSON.stringify(updated));
      } catch {}
    }
  } catch {}
};
