/**
 * lib/utils/documentUtils.js
 *
 * Pure helpers for quotations / estimates and delivery challans
 * (see docs/migrations/2026-11-04-documents.sql).
 *
 * A document is NOT a transaction: it has no paid amount, no status in the
 * ledger sense, and never touches contact balances, catalog stock or Reports.
 * Its line prices are a snapshot taken when it is saved, and converting it
 * to a sale uses exactly those lines — never today's catalog prices.
 *
 *   doc = {
 *     id, docType: "quotation" | "challan", docNo (null until the server numbers it),
 *     contactId, party: { name, phone, address, gstin },
 *     itemsList, additionalAmounts, gst (inputs only, like a bill), totalAmount,
 *     note, validUntil ("yyyy-MM-dd" | null), status: "open" | "converted" | "cancelled",
 *     convertedTxId, convertedAt, createdAt, updatedAt
 *   }
 */

import { format } from "date-fns";
import { stampSaleLines } from "@/lib/utils/costSnapshot";
import {
  buildGstSnapshot,
  computeGstForTx,
  normalizeGstin,
} from "@/lib/utils/gstUtils";

export const DOC_TYPES = {
  quotation: {
    id: "quotation",
    label: "Quotation",
    plural: "Quotations",
    short: "QTN",
    pdfTitle: "QUOTATION",
  },
  challan: {
    id: "challan",
    label: "Delivery challan",
    plural: "Delivery challans",
    short: "DC",
    pdfTitle: "DELIVERY CHALLAN",
  },
};

export const typeInfo = (docType) => DOC_TYPES[docType] ?? DOC_TYPES.quotation;

/** The number the server assigned, or a stable stand-in while it's pending. */
export const docRef = (doc) =>
  doc?.docNo ||
  `${typeInfo(doc?.docType).short}-${String(doc?.id ?? "")
    .slice(0, 8)
    .toUpperCase()}`;

export const partyName = (doc) =>
  doc?.party?.name?.trim() || "Walk-in customer";

export const todayISO = () => format(new Date(), "yyyy-MM-dd");
export const addDaysISO = (days) =>
  format(new Date(Date.now() + days * 86400000), "yyyy-MM-dd");

export const isExpired = (doc) =>
  doc?.docType === "quotation" &&
  doc?.status === "open" &&
  !!doc?.validUntil &&
  doc.validUntil < todayISO();

/** "open" | "expired" | "converted" | "cancelled" */
export const displayStatus = (doc) =>
  isExpired(doc) ? "expired" : (doc?.status ?? "open");

export const lineAmount = (line) =>
  (parseFloat(line?.quantity) || 0) * (parseFloat(line?.price) || 0);

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** { total, calc } — calc is the GST breakdown for a GST document, else null. */
export const computeDocTotals = ({ itemsList, additionalAmounts, gst }) => {
  if (gst) {
    const calc = computeGstForTx({ itemsList, additionalAmounts, gst });
    return { total: calc.grandTotal, calc };
  }
  const items = (itemsList ?? []).reduce((s, l) => s + lineAmount(l), 0);
  const extras = (additionalAmounts ?? []).reduce(
    (s, e) => s + (parseFloat(e?.amount) || 0),
    0,
  );
  return { total: round2(items + extras), calc: null };
};

/** Short "Item A, Item B +2" preview for list cards. */
export const itemsPreview = (doc) => {
  const names = (doc?.itemsList ?? [])
    .map((it) => (it.name || "").split(" › ").pop())
    .filter(Boolean);
  if (names.length === 0) return "";
  return (
    names.slice(0, 2).join(", ") +
    (names.length > 2 ? ` +${names.length - 2}` : "")
  );
};

/**
 * Builds the sale a document turns into.
 *
 *  - Lines are the document's SNAPSHOT lines, unchanged (prices are NOT re-read
 *    from the catalog). Only the recorded cost is stamped, as for any sale —
 *    that is the cost as of the moment of sale, i.e. now.
 *  - A GST document becomes a GST invoice. Buyer / place of supply / price mode
 *    come from the document; the SELLER side is rebuilt from today's profile,
 *    since an invoice must carry the seller's details as at billing.
 *  - The sale id is generated here, once, and reused on every retry of the same
 *    conversion — that is what lets the database recognise a retry.
 *
 * Returns { row, tx }: `row` is what the database function takes (snake_case),
 * `tx` the same sale in the shape the app's transaction caches use.
 * Throws Error("SELLER_GSTIN_MISSING") for a GST document when the shop has no GSTIN.
 */
export const buildSaleFromDocument = ({
  doc,
  business,
  contactId,
  catalogTree,
  now = new Date(),
}) => {
  const createdAt = now.toISOString();
  const itemsList = stampSaleLines({
    type: "out",
    kind: "item",
    lines: doc.itemsList ?? [],
    catalogTree,
  });
  const additionalAmounts = doc.additionalAmounts ?? [];

  let gst = null;
  if (doc.gst) {
    if (!normalizeGstin(business?.gstin))
      throw new Error("SELLER_GSTIN_MISSING");
    gst = buildGstSnapshot({
      business,
      buyerName: doc.party?.name,
      buyerAddress: doc.party?.address,
      buyerGstin: doc.gst.buyer?.gstin,
      placeOfSupply: doc.gst.placeOfSupply,
      mode: doc.gst.mode,
    });
  }

  const { total } = computeDocTotals({ itemsList, additionalAmounts, gst });
  const note = [
    `From ${typeInfo(doc.docType).label.toLowerCase()} ${docRef(doc)}`,
    doc.note?.trim(),
  ]
    .filter(Boolean)
    .join(" · ");
  const id = crypto.randomUUID();

  const row = {
    id,
    contact_id: contactId ?? null,
    items_list: itemsList,
    additional_amounts: additionalAmounts,
    total_amount: total,
    note,
    gst,
    created_at: createdAt,
  };

  const tx = {
    id,
    type: "out",
    kind: "item",
    contactId: contactId ?? null,
    linkedContactIds: [],
    itemsList,
    additionalAmounts,
    totalAmount: total,
    paidAmount: 0,
    paidAmountHistory: [],
    itemListHistory: [],
    note,
    status: "pending",
    createdAt,
    updatedAt: createdAt,
    gst,
    invoiceNo: null,
    invoiceSeq: null,
    invoiceFy: null,
    _role: "primary",
  };

  return { row, tx };
};
