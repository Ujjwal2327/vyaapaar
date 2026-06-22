/**
 * offlineQueue.js
 *
 * A localStorage-backed queue of write operations that couldn't be sent to
 * Supabase because the device was offline.  Each entry is a self-contained
 * "operation" object that the sync manager can replay later.
 *
 * Operation shape
 * ───────────────
 * {
 *   id          : string   – unique operation id (crypto.randomUUID)
 *   type        : string   – one of the OP_TYPES below
 *   payload     : object   – whatever data the operation needs
 *   localSnapshot: any     – the full local state snapshot AFTER the operation
 *                            (used for conflict detection: if the DB row's
 *                            updatedAt > our queuedAt we have a conflict)
 *   queuedAt    : string   – ISO timestamp when the op was enqueued
 *   userId      : string   – the authenticated user's id
 * }
 */

export const OP_TYPES = {
  // Price list (single JSONB blob per user)
  PRICE_LIST_SAVE: "PRICE_LIST_SAVE",

  // Contacts (one row per contact)
  CONTACTS_UPSERT: "CONTACTS_UPSERT",   // payload: { rows: [...] }
  CONTACTS_DELETE: "CONTACTS_DELETE",   // payload: { ids: [...] }

  // Categories (stored in public.people)
  CATEGORIES_SAVE: "CATEGORIES_SAVE",   // payload: { categories: [...] }

  // Transactions
  TX_INSERT: "TX_INSERT",               // payload: { row: {...} }
  TX_UPSERT: "TX_UPSERT",              // payload: { rows: [...] }
  TX_UPDATE: "TX_UPDATE",              // payload: { id, updates: {...} }
  TX_ASSIGN_CONTACT: "TX_ASSIGN_CONTACT", // payload: { txId, contactId, allowReassign }
  TX_UNASSIGN_CONTACT: "TX_UNASSIGN_CONTACT", // payload: { txId }
};

const QUEUE_KEY = "offlineQueue_v1";

// ─── persistence helpers ──────────────────────────────────────────────────────

const readQueue = () => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeQueue = (ops) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
  } catch (e) {
    console.error("[offlineQueue] Failed to persist queue:", e);
  }
};

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Add an operation to the offline queue.
 * Returns the enqueued operation object.
 */
export const enqueue = (type, payload, localSnapshot, userId) => {
  const op = {
    id: crypto.randomUUID(),
    type,
    payload,
    localSnapshot,
    queuedAt: new Date().toISOString(),
    userId,
  };
  const queue = readQueue();
  queue.push(op);
  writeQueue(queue);
  // Notify any listeners (e.g. useSyncManager)
  window.dispatchEvent(new Event("offlineQueueChanged"));
  return op;
};

/**
 * Read the entire queue (all users, filtered externally if needed).
 */
export const getQueue = () => readQueue();

/**
 * Remove one or more operations by id.
 */
export const dequeue = (ids) => {
  const set = new Set(Array.isArray(ids) ? ids : [ids]);
  const next = readQueue().filter((op) => !set.has(op.id));
  writeQueue(next);
  window.dispatchEvent(new Event("offlineQueueChanged"));
};

/**
 * Replace the entire queue (used after conflict resolution).
 */
export const replaceQueue = (ops) => {
  writeQueue(ops);
  window.dispatchEvent(new Event("offlineQueueChanged"));
};

/**
 * How many pending ops are there for a given userId?
 */
export const pendingCount = (userId) =>
  readQueue().filter((op) => op.userId === userId).length;

/**
 * Clear all ops for a userId (e.g. on sign-out).
 */
export const clearForUser = (userId) => {
  const next = readQueue().filter((op) => op.userId !== userId);
  writeQueue(next);
  window.dispatchEvent(new Event("offlineQueueChanged"));
};

/**
 * Collapse redundant ops of the same type so we only replay the latest.
 *
 * Rules:
 *  - PRICE_LIST_SAVE  → keep only the last one (it's a full blob replace)
 *  - CATEGORIES_SAVE  → keep only the last one
 *  - CONTACTS_UPSERT  → merge into a single upsert with the latest row per id
 *  - CONTACTS_DELETE  → merge into a single delete with all ids
 *  - TX_*             → keep all (each is a distinct logical operation)
 *
 * Call this before replaying the queue to minimise round-trips.
 */
export const collapseQueue = (ops) => {
  const out = [];
  let latestPriceList = null;
  let latestCategories = null;
  const upsertRowMap = new Map(); // contactId → latest row
  const deleteIds = new Set();

  // Collect TX ops in order
  const txOps = [];

  for (const op of ops) {
    switch (op.type) {
      case OP_TYPES.PRICE_LIST_SAVE:
        latestPriceList = op;
        break;
      case OP_TYPES.CATEGORIES_SAVE:
        latestCategories = op;
        break;
      case OP_TYPES.CONTACTS_UPSERT:
        for (const row of op.payload.rows) {
          upsertRowMap.set(row.id, row);
        }
        break;
      case OP_TYPES.CONTACTS_DELETE:
        for (const id of op.payload.ids) {
          deleteIds.add(id);
          upsertRowMap.delete(id); // no point upserting something we're deleting
        }
        break;
      default:
        txOps.push(op);
    }
  }

  if (latestPriceList) out.push(latestPriceList);
  if (latestCategories) out.push(latestCategories);
  if (upsertRowMap.size > 0) {
    // Synthesise a merged upsert op (use timestamp of last individual op)
    const lastUpsert = [...ops]
      .reverse()
      .find((o) => o.type === OP_TYPES.CONTACTS_UPSERT);
    out.push({
      ...lastUpsert,
      id: crypto.randomUUID(),
      payload: { rows: Array.from(upsertRowMap.values()) },
    });
  }
  if (deleteIds.size > 0) {
    const lastDelete = [...ops]
      .reverse()
      .find((o) => o.type === OP_TYPES.CONTACTS_DELETE);
    out.push({
      ...lastDelete,
      id: crypto.randomUUID(),
      payload: { ids: Array.from(deleteIds) },
    });
  }
  out.push(...txOps);

  return out;
};