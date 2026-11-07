/**
 * lib/utils/documentConversion.js
 *
 * Everything that happens when a quotation / challan becomes a sale, kept in
 * ONE place because two callers need it: hooks/useDocuments.js (the tap, when
 * online) and hooks/useSyncManager.js (replaying a conversion that was queued
 * offline).
 *
 * The idempotency lives in the database (convert_document_to_sale — see
 * docs/migrations/2026-11-04-documents.sql). This file only reacts to what it
 * says:
 *
 *   converted: true   → this call created the sale. Take stock off the catalog
 *                       (apply_effects), number the GST invoice, re-derive the
 *                       contact's balance.
 *   converted: false  → it had ALREADY been converted. Nothing was created, so
 *                       nothing is done: no second sale, no second stock deduction.
 *
 * Stock is applied only when the database says apply_effects, which is true
 * exactly once per document.
 */

import { supabase } from "@/lib/supabase";
import { enqueue, OP_TYPES } from "@/lib/offlineQueue";
import { computeStockDeltas, applyStockDeltas } from "@/lib/utils/stockUtils";
import { computeContactNetAmount } from "@/lib/utils/contactNetAmount";
import { PRICE_LIST_UPDATED_EVENT } from "@/hooks/usePriceList";
import { recomputeContactNetAmounts } from "@/hooks/useTransactions";
import { patchContactNetAmountInCache } from "@/hooks/usePeople";

const cacheKeyFor = (contactId) => `transactions_${contactId || "none"}`;

// ─── optimistic local cache helpers (offline conversion) ─────────────────────

export const pushSaleToLocalCache = (tx, contactId) => {
  try {
    const key = cacheKeyFor(contactId);
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    localStorage.setItem(
      key,
      JSON.stringify([
        { ...tx, _role: "primary" },
        ...list.filter((t) => t.id !== tx.id),
      ]),
    );
  } catch {
    // best-effort cache, same as everywhere else in this app
  }
};

export const removeSaleFromLocalCache = (txId, contactId) => {
  try {
    const key = cacheKeyFor(contactId);
    const raw = localStorage.getItem(key);
    if (!raw) return;
    localStorage.setItem(
      key,
      JSON.stringify(JSON.parse(raw).filter((t) => t.id !== txId)),
    );
  } catch {
    // ignore
  }
};

/** Instant, local-only nudge of a contact's cached balance by one sale's amount. */
export const nudgeContactNetAmount = (contactId, tx) => {
  if (!contactId) return;
  try {
    const raw = localStorage.getItem("peopleData");
    if (!raw) return;
    const current = JSON.parse(raw).find((p) => p.id === contactId);
    if (!current) return;
    patchContactNetAmountInCache(
      contactId,
      (current.netAmount ?? 0) + computeContactNetAmount([tx]),
    );
  } catch {
    // ignore
  }
};

// ─── side effects of a sale that was really created ──────────────────────────

// Same delta-based, fetch-fresh-then-write approach as applyStockAdjustments in
// hooks/useTransactions.js (see the long comment there for why), for the one
// case this needs: a brand-new sale.
const applyStockForSale = async (itemsList, userId) => {
  try {
    const deltas = computeStockDeltas([], itemsList, "out");
    if (deltas.length === 0) return;

    const readLocalTree = () => {
      try {
        const raw = localStorage.getItem("priceListData");
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    };
    const applyLocallyAndQueue = (baseTree) => {
      const { tree, changed } = applyStockDeltas(baseTree, deltas);
      if (!changed) return;
      localStorage.setItem("priceListData", JSON.stringify(tree));
      window.dispatchEvent(new Event(PRICE_LIST_UPDATED_EVENT));
      enqueue(OP_TYPES.PRICE_LIST_SAVE, { data: tree }, tree, userId);
    };

    if (!navigator.onLine) {
      applyLocallyAndQueue(readLocalTree());
      return;
    }

    try {
      const { data: row, error } = await supabase
        .from("price_lists")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;

      const { tree, changed } = applyStockDeltas(row?.data ?? {}, deltas);
      if (!changed) return;

      const { error: upsertErr } = await supabase
        .from("price_lists")
        .upsert({ user_id: userId, data: tree }, { onConflict: "user_id" });
      if (upsertErr) throw upsertErr;

      localStorage.setItem("priceListData", JSON.stringify(tree));
      window.dispatchEvent(new Event(PRICE_LIST_UPDATED_EVENT));
    } catch {
      applyLocallyAndQueue(readLocalTree());
    }
  } catch (err) {
    // a derived bookkeeping step must never make the conversion look failed
    console.warn("[documentConversion] stock adjustment failed:", err?.message);
  }
};

// Idempotent on the database side (a bill that already has a number just gets
// it back); if it can't be issued right now it's queued, exactly like a GST
// bill saved offline.
const ensureInvoiceNumber = async (txId, userId) => {
  try {
    const { error } = await supabase.rpc("assign_invoice_number", {
      p_tx_id: txId,
    });
    if (error) throw error;
  } catch (err) {
    console.warn("[documentConversion] invoice number deferred:", err?.message);
    enqueue(OP_TYPES.TX_ASSIGN_INVOICE_NO, { txId }, null, userId);
  }
};

/**
 * Asks the database to convert the document — safe to call any number of times
 * with the same (docId, txRow.id).
 *
 * Resolves to:
 *   { ok: true, txId, converted, mine }
 *       converted — this call created the sale
 *       mine      — the sale that exists IS the one in txRow (false when another
 *                   device converted the document first, with a different id)
 *   { ok: false, reason: "cancelled" | "missing" }   permanent, don't retry
 * Throws on anything else (network, etc.) so the caller can queue a retry.
 */
export const convertDocumentOnServer = async ({ docId, txRow, userId }) => {
  const { data, error } = await supabase.rpc("convert_document_to_sale", {
    p_doc_id: docId,
    p_tx: txRow,
  });

  if (error) {
    const msg = error.message || "";
    if (
      msg.includes("DOCUMENT_CANCELLED") ||
      msg.includes("DOCUMENT_NOT_FOUND")
    ) {
      // The optimistic sale we may have shown locally never existed on the server.
      removeSaleFromLocalCache(txRow.id, txRow.contact_id);
      await recomputeContactNetAmounts([txRow.contact_id], userId);
      return {
        ok: false,
        reason: msg.includes("CANCELLED") ? "cancelled" : "missing",
      };
    }
    throw error;
  }

  const mine = data?.tx_id === txRow.id;

  if (data?.apply_effects) {
    await applyStockForSale(txRow.items_list, userId);
  }

  if (mine) {
    if (txRow.gst) await ensureInvoiceNumber(txRow.id, userId);
    await recomputeContactNetAmounts([txRow.contact_id], userId);
  } else {
    // Another device converted it first: drop the sale we showed optimistically.
    removeSaleFromLocalCache(txRow.id, txRow.contact_id);
    await recomputeContactNetAmounts([txRow.contact_id], userId);
  }

  return { ok: true, txId: data?.tx_id, converted: !!data?.converted, mine };
};
