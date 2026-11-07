"use client";

/**
 * hooks/useDocuments.js
 *
 * Quotations / estimates and delivery challans, offline-first like the other
 * data hooks: serve the localStorage cache instantly, refresh from the server
 * in the background, queue writes (lib/offlineQueue.js) when offline.
 *
 * What a document is NOT: a transaction. Nothing here touches the ledger,
 * contact balances, catalog stock or Reports — until convertDocument() turns
 * one into a sale.
 *
 * convertDocument is idempotent at three levels:
 *   1. in-flight: a second tap while the first is running is ignored;
 *   2. local state: a document already marked converted returns its sale;
 *   3. the database: convert_document_to_sale locks the document row and
 *      creates the sale at most once, however many devices / retries / double
 *      taps reach it (see docs/migrations/2026-11-04-documents.sql and
 *      lib/utils/documentConversion.js).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { enqueue, getQueue, OP_TYPES } from "@/lib/offlineQueue";
import { buildSaleFromDocument } from "@/lib/utils/documentUtils";
import {
  convertDocumentOnServer,
  pushSaleToLocalCache,
  nudgeContactNetAmount,
} from "@/lib/utils/documentConversion";

export const DOCS_REFRESH_EVENT = "docsRefreshNeeded";

const CACHE_KEY = "documentsCache_v1";
const PAGE_SIZE = 1000;

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

// The catalog as this device last cached it — what the sale's cost snapshot is
// read from at conversion time (same approach as hooks/useTransactions.js).
const readCatalogTree = () => {
  try {
    const raw = localStorage.getItem("priceListData");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// ─── row ↔ document ──────────────────────────────────────────────────────────

const rowToDoc = (r) => ({
  id: r.id,
  docType: r.doc_type,
  docNo: r.doc_no ?? null,
  docSeq: r.doc_seq ?? null,
  docFy: r.doc_fy ?? null,
  contactId: r.contact_id ?? null,
  party: r.party ?? {},
  itemsList: r.items_list ?? [],
  additionalAmounts: r.additional_amounts ?? [],
  gst: r.gst ?? null,
  totalAmount: Number(r.total_amount) || 0,
  note: r.note ?? "",
  validUntil: r.valid_until ?? null,
  status: r.status ?? "open",
  convertedTxId: r.converted_tx_id ?? null,
  convertedAt: r.converted_at ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// The columns a user can edit. doc_no / doc_seq / doc_fy / doc_type / user_id
// are never sent on update — the database owns them.
const editableRow = (doc) => ({
  contact_id: doc.contactId ?? null,
  party: doc.party ?? {},
  items_list: doc.itemsList ?? [],
  additional_amounts: doc.additionalAmounts ?? [],
  gst: doc.gst ?? null,
  total_amount: doc.totalAmount ?? 0,
  note: doc.note ?? "",
  valid_until: doc.validUntil || null,
  status: doc.status,
  updated_at: doc.updatedAt,
});

const insertRow = (doc, userId) => ({
  id: doc.id,
  user_id: userId,
  doc_type: doc.docType,
  ...editableRow(doc),
  status: "open",
  created_at: doc.createdAt,
});

const byNewest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

// Documents with unsynced changes keep their local version when a refetch
// lands before the offline queue has been replayed — otherwise a quotation made
// offline would vanish from the list until the sync finished.
const mergeWithPending = (server, local, userId) => {
  const pendingIds = new Set(
    getQueue()
      .filter((o) => o.userId === userId && o.type.startsWith("DOC_"))
      .map((o) => o.payload?.docId)
      .filter(Boolean),
  );
  if (pendingIds.size === 0) return server;

  const localById = new Map(local.map((d) => [d.id, d]));
  const merged = server.map((d) =>
    pendingIds.has(d.id) && localById.has(d.id) ? localById.get(d.id) : d,
  );
  const serverIds = new Set(server.map((d) => d.id));
  for (const id of pendingIds) {
    if (!serverIds.has(id) && localById.has(id)) merged.push(localById.get(id));
  }
  return merged.sort(byNewest);
};

const fetchAllRows = async (userId) => {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
};

// ─── hook ────────────────────────────────────────────────────────────────────

export const useDocuments = () => {
  const { user, loading: authLoading } = useAuth();

  const [documents, setDocuments] = useState([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const docsRef = useRef([]); // always-current copy for async callbacks
  const userIdRef = useRef(null);
  const hasFetched = useRef(false);
  const convertingRef = useRef(new Set()); // document ids being converted right now

  const commit = useCallback((updater) => {
    const next =
      typeof updater === "function" ? updater(docsRef.current) : updater;
    docsRef.current = next;
    setDocuments(next);
    try {
      if (userIdRef.current) {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ userId: userIdRef.current, documents: next }),
        );
      }
    } catch {
      // best-effort cache
    }
  }, []);

  // ── load: cache first, then the server ─────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const uid = user?.id ?? null;
      if (hasFetched.current && uid !== userIdRef.current) {
        hasFetched.current = false;
        docsRef.current = [];
        setDocuments([]);
      }
      userIdRef.current = uid;

      if (hasFetched.current) {
        setIsDataLoading(false);
        setIsHydrated(true);
        return;
      }
      if (authLoading) return;

      hasFetched.current = true;
      setIsDataLoading(true);

      if (user) {
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          const cached = raw ? JSON.parse(raw) : null;
          if (cached?.userId === user.id && Array.isArray(cached.documents)) {
            docsRef.current = cached.documents;
            setDocuments(cached.documents);
          }
        } catch {
          // ignore malformed cache
        }
      }
      setIsHydrated(true);

      if (!user || !navigator.onLine) {
        setIsDataLoading(false);
        return;
      }

      try {
        const server = (await fetchAllRows(user.id)).map(rowToDoc);
        commit(mergeWithPending(server, docsRef.current, user.id));
      } catch (err) {
        console.warn("[useDocuments] fetch failed (offline?):", err?.message);
      } finally {
        setIsDataLoading(false);
      }
    };

    load();

    const refetch = () => {
      hasFetched.current = false;
      load();
    };
    window.addEventListener(DOCS_REFRESH_EVENT, refetch);
    window.addEventListener("online", refetch);
    return () => {
      window.removeEventListener(DOCS_REFRESH_EVENT, refetch);
      window.removeEventListener("online", refetch);
    };
  }, [user, authLoading, commit]);

  // ── create ─────────────────────────────────────────────────────────────────
  const addDocument = useCallback(
    async (payload) => {
      if (!user) throw new Error("NOT_AUTHENTICATED");
      const now = new Date().toISOString();
      const doc = {
        ...payload,
        id: crypto.randomUUID(),
        docNo: null, // issued by the database
        docSeq: null,
        docFy: null,
        status: "open",
        convertedTxId: null,
        convertedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      commit((prev) => [doc, ...prev]);

      const row = insertRow(doc, user.id);
      const queueIt = () =>
        enqueue(OP_TYPES.DOC_INSERT, { docId: doc.id, row }, doc, user.id);

      if (!navigator.onLine) {
        queueIt();
        return doc;
      }
      try {
        const { data, error } = await supabase
          .from("documents")
          .insert([row])
          .select("*")
          .single();
        if (error) throw error;
        const saved = rowToDoc(data);
        commit((prev) => prev.map((d) => (d.id === doc.id ? saved : d)));
        return saved;
      } catch (err) {
        if (isNetworkError(err)) {
          queueIt();
          return doc;
        }
        commit((prev) => prev.filter((d) => d.id !== doc.id)); // roll back
        throw err;
      }
    },
    [user, commit],
  );

  // ── edit / cancel (open documents only) ────────────────────────────────────
  const updateDocument = useCallback(
    async (id, changes) => {
      if (!user) throw new Error("NOT_AUTHENTICATED");
      const current = docsRef.current.find((d) => d.id === id);
      if (!current) throw new Error("DOC_NOT_FOUND");
      if (current.status !== "open") throw new Error("DOC_NOT_OPEN");

      const next = {
        ...current,
        ...changes,
        updatedAt: new Date().toISOString(),
      };
      commit((prev) => prev.map((d) => (d.id === id ? next : d)));

      const updates = editableRow(next);
      const queueIt = () =>
        enqueue(OP_TYPES.DOC_UPDATE, { docId: id, updates }, next, user.id);

      if (!navigator.onLine) {
        queueIt();
        return next;
      }
      try {
        const { data, error } = await supabase
          .from("documents")
          .update(updates)
          .eq("id", id)
          .eq("user_id", user.id)
          .eq("status", "open")
          .select("id");
        if (error) throw error;
        if (!data || data.length === 0) {
          // Not open any more on the server (converted / cancelled elsewhere).
          commit((prev) => prev.map((d) => (d.id === id ? current : d)));
          window.dispatchEvent(new Event(DOCS_REFRESH_EVENT));
          throw new Error("DOC_NOT_OPEN");
        }
        return next;
      } catch (err) {
        if (isNetworkError(err)) {
          queueIt();
          return next;
        }
        if (err?.message !== "DOC_NOT_OPEN") {
          commit((prev) => prev.map((d) => (d.id === id ? current : d)));
        }
        throw err;
      }
    },
    [user, commit],
  );

  const cancelDocument = useCallback(
    (id) => updateDocument(id, { status: "cancelled" }),
    [updateDocument],
  );

  // ── convert to sale ────────────────────────────────────────────────────────
  /**
   * @param {string} id
   * @param {object} ctx
   * @param {object} ctx.business        useBusinessProfile().profile (seller details for GST)
   * @param {(contactId:string)=>boolean} [ctx.contactExists]
   *
   * Resolves to { txId, contactId, queued? } for a conversion this call
   * performed, { alreadyConverted: true, txId, contactId } when the document
   * had already become a sale (nothing is created), or { skipped: true } when
   * a conversion of the same document is already running.
   * Throws Error("DOC_CANCELLED" | "DOC_NOT_FOUND" | "SELLER_GSTIN_MISSING").
   */
  const convertDocument = useCallback(
    async (id, { business, contactExists } = {}) => {
      if (!user) throw new Error("NOT_AUTHENTICATED");
      if (convertingRef.current.has(id)) return { skipped: true };

      const doc = docsRef.current.find((d) => d.id === id);
      if (!doc) throw new Error("DOC_NOT_FOUND");
      if (doc.status === "converted") {
        return {
          alreadyConverted: true,
          txId: doc.convertedTxId,
          contactId: doc.contactId,
        };
      }
      if (doc.status !== "open") throw new Error("DOC_CANCELLED");

      convertingRef.current.add(id);
      try {
        const contactId =
          doc.contactId && (!contactExists || contactExists(doc.contactId))
            ? doc.contactId
            : null;
        // The sale (and its id) is built ONCE; every retry reuses this exact id.
        const { row: txRow, tx } = buildSaleFromDocument({
          doc,
          business,
          contactId,
          catalogTree: readCatalogTree(),
        });

        const markConverted = (txId) =>
          commit((prev) =>
            prev.map((d) =>
              d.id === id
                ? {
                    ...d,
                    status: "converted",
                    convertedTxId: txId,
                    convertedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  }
                : d,
            ),
          );

        // Offline (or the request couldn't get through): show the sale locally
        // and queue the conversion. Stock is NOT touched here — it is applied
        // when the queued conversion actually runs and the database confirms
        // this was the one that created the sale.
        const queueIt = () => {
          markConverted(txRow.id);
          pushSaleToLocalCache(tx, contactId);
          nudgeContactNetAmount(contactId, tx);
          enqueue(OP_TYPES.DOC_CONVERT, { docId: id, txRow }, null, user.id);
          return { txId: txRow.id, contactId, queued: true };
        };

        if (!navigator.onLine) return queueIt();

        try {
          const res = await convertDocumentOnServer({
            docId: id,
            txRow,
            userId: user.id,
          });
          if (!res.ok) {
            window.dispatchEvent(new Event(DOCS_REFRESH_EVENT));
            throw new Error(
              res.reason === "cancelled" ? "DOC_CANCELLED" : "DOC_NOT_FOUND",
            );
          }
          markConverted(res.txId);
          return res.mine
            ? { txId: res.txId, contactId }
            : {
                alreadyConverted: true,
                txId: res.txId,
                contactId: doc.contactId,
              };
        } catch (err) {
          if (isNetworkError(err)) return queueIt();
          throw err;
        }
      } finally {
        convertingRef.current.delete(id);
      }
    },
    [user, commit],
  );

  return {
    documents,
    isHydrated,
    isDataLoading,
    addDocument,
    updateDocument,
    cancelDocument,
    convertDocument,
  };
};
