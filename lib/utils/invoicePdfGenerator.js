/**
 * lib/utils/invoicePdfGenerator.js
 *
 * v3 (consistency pass): look comes from the shared lib/utils/docTheme.js +
 * lib/utils/pdfTheme.js (same fonts, sizes, colours, header, footer, money and
 * date format as the tax invoice, statement and contacts directory). Plain
 * invoices now show the date without the time, like every other document.
 * v2 (GST review): the download object URL is no longer revoked immediately.
 *
 * Generates an invoice / receipt PDF for a single transaction — the
 * transaction-level sibling of lib/utils/pdfGenerator.js's contacts
 * export.
 *
 * Two entry points, mirroring the "download" vs "share" split already
 * established for images in lib/utils/cartShare.js:
 *   - downloadTransactionInvoice: builds the PDF and triggers a normal
 *     browser download, same shape as generateContactsPDF.
 *   - shareTransactionInvoice: offers the PDF through the native share
 *     sheet first (so it can land directly in WhatsApp/email/Drive/etc. as
 *     a real attached file), falling back to a plain download wherever
 *     navigator.share with files isn't available (mainly desktop).
 */

import React from "react";
import { Document, Page, Text, View, pdf } from "@react-pdf/renderer";
import { GstInvoiceDocument } from "@/lib/utils/gstInvoiceDocument";
import { invoiceFileStem } from "@/lib/utils/gstUtils";
import {
  fmtDate,
  fmtQty,
  money,
  shortRef,
  splitItemName,
} from "@/lib/utils/docTheme";
import { PdfFooter, PdfHeader, S, W, right } from "@/lib/utils/pdfTheme";

// Look (fonts, sizes, colours, header, footer, table style) comes from
// lib/utils/docTheme.js + lib/utils/pdfTheme.js — shared with the tax invoice,
// the statement and the contacts directory so they all match.

// Handles both the current `phones` array shape and the legacy single
// `phone` string, same fallback PersonCard.jsx and friends already use.
const primaryPhoneOf = (contact) => {
  if (!contact) return null;
  const phones = contact.phones ?? (contact.phone ? [contact.phone] : []);
  return phones.find((p) => p && p.trim()) || null;
};

/* ============================
   SUB-COMPONENTS
   ============================ */

const ItemsTable = ({ items, extras }) => (
  <View style={S.table}>
    <View style={S.tableHeaderRow} fixed>
      <View style={[S.th, W(42)]}>
        <Text>Item</Text>
      </View>
      <View style={[S.th, W(13)]}>
        <Text>Qty</Text>
      </View>
      <View style={[S.th, W(13)]}>
        <Text>Unit</Text>
      </View>
      <View style={[S.th, W(16), right]}>
        <Text>Price</Text>
      </View>
      <View style={[S.th, W(16), right]}>
        <Text>Amount</Text>
      </View>
    </View>

    {items.map((it, i) => {
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.price) || 0;
      const lineTotal = qty * price;
      // Item names are stored as a " › "-joined catalog path — the leaf is the
      // line item, the rest a small subtext (same as the on-screen rows).
      const { leaf, path } = splitItemName(it.name);

      return (
        <View key={i} style={S.tableRow} wrap={false}>
          <View style={[S.td, W(42)]}>
            <Text>{leaf}</Text>
            {path ? <Text style={S.tdSub}>{path}</Text> : null}
          </View>
          <View style={[S.td, W(13)]}>
            <Text>{fmtQty(qty)}</Text>
          </View>
          <View style={[S.td, W(13)]}>
            <Text>{it.unit || "-"}</Text>
          </View>
          <View style={[S.td, W(16), right]}>
            <Text>{money(price)}</Text>
          </View>
          <View style={[S.td, W(16), right]}>
            <Text>{money(lineTotal)}</Text>
          </View>
        </View>
      );
    })}

    {/* Additional amounts / discounts — label + amount only. */}
    {extras.map((e, i) => {
      const amt = parseFloat(e.amount) || 0;
      return (
        <View key={`extra-${i}`} style={S.tableRow} wrap={false}>
          <View style={[S.td, W(68)]}>
            <Text>{e.name}</Text>
            {e.note ? <Text style={S.tdSub}>{e.note}</Text> : null}
          </View>
          <View style={[S.td, W(16)]} />
          <View style={[S.td, W(16), right]}>
            <Text>{money(amt)}</Text>
          </View>
        </View>
      );
    })}
  </View>
);

const FinancialTable = ({ transaction }) => {
  const label =
    transaction.type === "out" ? "Payment received" : "Payment made";
  return (
    <View style={S.table}>
      <View style={S.tableHeaderRow} fixed>
        <View style={[S.th, W(75)]}>
          <Text>Description</Text>
        </View>
        <View style={[S.th, W(25), right]}>
          <Text>Amount</Text>
        </View>
      </View>
      <View style={S.tableRow}>
        <View style={[S.td, W(75)]}>
          <Text>{label}</Text>
        </View>
        <View style={[S.td, W(25), right]}>
          <Text>{money(transaction.totalAmount)}</Text>
        </View>
      </View>
    </View>
  );
};

const InvoiceDocument = ({ transaction, business, contact }) => {
  const isItem = transaction.kind === "item";
  const isSale = transaction.type === "out";
  // A "purchase" is money/goods flowing the other way — this business is
  // the buyer, not the seller — so it gets a different document label and
  // a "Received From" party line rather than a conventional "Bill To".
  const docLabel = isSale ? "Invoice" : "Purchase Bill";
  const partyLabel = isSale ? "Bill To" : "Received From";

  const items = (transaction.itemsList || []).filter((it) => it?.name?.trim());
  const extras = (transaction.additionalAmounts || []).filter((e) =>
    e?.name?.trim(),
  );

  const total = transaction.totalAmount || 0;
  const paid = transaction.paidAmount || 0;
  const balance = total - paid;
  const isSettled = Math.abs(balance) < 0.01;
  const isAdvance = balance < -0.01;

  let balanceLabel;
  let balanceValue;
  if (isSettled) {
    balanceLabel = "Status";
    balanceValue = "Settled";
  } else if (isAdvance) {
    balanceLabel = isSale ? "Advance / Credit" : "Advance to Receive";
    balanceValue = money(Math.abs(balance));
  } else {
    balanceLabel = "Balance Due";
    balanceValue = money(balance);
  }

  const phone = primaryPhoneOf(contact);

  return (
    <Document>
      <Page size="A4" style={S.page}>
        <PdfHeader
          name={business?.businessName || "Your Business"}
          lines={[
            business?.businessAddress,
            business?.phone ? `Ph: ${business.phone}` : null,
            business?.email,
          ]}
          title={docLabel}
          meta={[
            `Ref #${shortRef(transaction.id)}`,
            `Date: ${fmtDate(transaction.createdAt)}`,
          ]}
        />

        {/* Bill To / Received From */}
        <View style={S.section}>
          <Text style={S.label}>{partyLabel}</Text>
          {contact ? (
            <>
              <Text style={S.partyName}>{contact.name}</Text>
              {phone ? <Text style={S.partyLine}>{phone}</Text> : null}
              {contact.address ? (
                <Text style={S.partyLine}>{contact.address}</Text>
              ) : null}
            </>
          ) : (
            <Text style={S.partyName}>Walk-in customer</Text>
          )}
        </View>

        {/* Items, or the plain amount for a financial transaction */}
        {isItem ? (
          <ItemsTable items={items} extras={extras} />
        ) : (
          <FinancialTable transaction={transaction} />
        )}

        {/* Totals */}
        <View style={S.totalsWrap}>
          <View style={S.totalsBlock}>
            <View style={S.totalsRow}>
              <Text style={S.totalsLabel}>Total</Text>
              <Text style={S.totalsValue}>{money(total)}</Text>
            </View>
            <View style={S.totalsRow}>
              <Text style={S.totalsLabel}>Paid</Text>
              <Text style={S.totalsValue}>{money(paid)}</Text>
            </View>
            <View style={S.grandRow}>
              <Text style={S.grandLabel}>{balanceLabel}</Text>
              <Text style={S.grandValue}>{balanceValue}</Text>
            </View>
          </View>
        </View>

        {/* Note */}
        {transaction.note?.trim() ? (
          <View style={S.noteBox}>
            <Text style={S.label}>Note</Text>
            <Text style={S.noteText}>{transaction.note}</Text>
          </View>
        ) : null}

        <PdfFooter />
      </Page>
    </Document>
  );
};

/* ============================
   BLOB / FILE HELPERS
   ============================ */

const buildInvoiceFilename = (transaction) => {
  // A GST invoice is named after its (gapless) invoice number.
  if (transaction?.gst && transaction.invoiceNo)
    return `Tax-Invoice_${invoiceFileStem(transaction.invoiceNo)}.pdf`;
  const label = transaction?.type === "out" ? "Invoice" : "Purchase-Bill";
  const ref = transaction?.id ? transaction.id.slice(0, 8) : "unknown";
  const dateSrc = transaction?.createdAt
    ? new Date(transaction.createdAt)
    : new Date();
  const dateStr = dateSrc.toISOString().slice(0, 10);
  return `${label}_${ref}_${dateStr}.pdf`;
};

const buildInvoiceBlob = ({ transaction, business, contact }) => {
  // A transaction carrying `gst` is a GST bill: it gets the tax-invoice layout,
  // built from the seller/buyer snapshot stored on the bill. It can't be
  // produced before the server has issued its number (offline bills get it on
  // sync) — a tax invoice without a number would be invalid, and handing one
  // out would defeat the point of a gapless series.
  if (transaction?.gst) {
    if (!transaction.invoiceNo) {
      return Promise.reject(new Error("INVOICE_NUMBER_PENDING"));
    }
    return pdf(
      <GstInvoiceDocument transaction={transaction} contact={contact} />,
    ).toBlob();
  }
  return pdf(
    <InvoiceDocument
      transaction={transaction}
      business={business}
      contact={contact}
    />,
  ).toBlob();
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoking straight away can cancel the download in some browsers (notably
  // mobile Safari / Firefox) — give it a moment first.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

/* ============================
   EXPORTED FUNCTIONS
   ============================ */

/**
 * Builds the invoice PDF for one transaction and triggers a normal browser
 * download — the same "build blob, download it" shape as
 * generateContactsPDF in lib/utils/pdfGenerator.js.
 *
 * @param {object} params
 * @param {object} params.transaction - a transaction object as returned by
 *   hooks/useTransactions.js (id, type, kind, itemsList, additionalAmounts,
 *   totalAmount, paidAmount, note, createdAt, ...).
 * @param {object|null} params.business - { businessName, businessAddress,
 *   phone, email } as returned by hooks/useBusinessProfile.js. Missing
 *   fields are simply omitted from the header.
 * @param {object|null} params.contact - the transaction's assigned contact
 *   record ({ name, phones, address, ... }), or null/undefined for a
 *   walk-in / unassigned transaction.
 */
export const downloadTransactionInvoice = async ({
  transaction,
  business,
  contact,
}) => {
  const blob = await buildInvoiceBlob({ transaction, business, contact });
  downloadBlob(blob, buildInvoiceFilename(transaction));
};

/**
 * Same PDF, offered through the native share sheet first (so it can go
 * straight into WhatsApp/email/Drive/etc. as a real attached file) —
 * mirrors the share-then-fallback shape in lib/utils/cartShare.js. Falls
 * back to a plain download wherever navigator.share with files isn't
 * available (mainly desktop browsers) or the user cancels the share sheet.
 *
 * Returns { method: "share" | "download" | "cancelled" }.
 */
export const shareTransactionInvoice = async ({
  transaction,
  business,
  contact,
}) => {
  const blob = await buildInvoiceBlob({ transaction, business, contact });
  const filename = buildInvoiceFilename(transaction);
  const file = new File([blob], filename, { type: "application/pdf" });

  if (
    typeof navigator !== "undefined" &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: filename.replace(/\.pdf$/, ""),
      });
      return { method: "share" };
    } catch (err) {
      if (err?.name === "AbortError") return { method: "cancelled" };
      // Any other failure — fall through to a plain download instead of
      // failing the whole action.
    }
  }

  downloadBlob(blob, filename);
  return { method: "download" };
};
