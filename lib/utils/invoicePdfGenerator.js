/**
 * lib/utils/invoicePdfGenerator.js
 *
 * Generates an invoice / receipt PDF for a single transaction — the
 * transaction-level sibling of lib/utils/pdfGenerator.js's contacts
 * export. Deliberately reuses that file's exact font registration and the
 * same black-on-white, thin-border visual language (see its
 * `createStyles`) rather than inventing a second look for this app's PDFs.
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
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Font,
} from "@react-pdf/renderer";
import { format } from "date-fns";

// Same local font files as lib/utils/pdfGenerator.js. Registering the same
// family twice (once per file, if both ever load in the same session) is
// harmless — this just keeps this file usable on its own.
Font.register({
  family: "Ubuntu",
  fonts: [
    { src: "/fonts/Ubuntu-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Ubuntu-Medium.ttf", fontWeight: "500" },
    { src: "/fonts/Ubuntu-Bold.ttf", fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: {
    paddingTop: 20,
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 20,
    fontFamily: "Ubuntu",
    fallbackFont: "Helvetica",
    fontSize: 10,
    backgroundColor: "#ffffff",
    color: "#000000",
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#000000",
    paddingBottom: 12,
  },
  businessBlock: { maxWidth: "58%" },
  businessName: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  businessLine: { fontSize: 9.5, color: "#333333", marginBottom: 2 },
  docBlock: { maxWidth: "38%", alignItems: "flex-end" },
  docTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 6 },
  docMetaLine: {
    fontSize: 9.5,
    color: "#333333",
    marginBottom: 2,
    textAlign: "right",
  },

  section: { marginBottom: 14 },
  sectionLabel: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#666666",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  partyName: { fontSize: 13, fontWeight: "bold", marginBottom: 2 },
  partyLine: { fontSize: 10, color: "#333333", marginBottom: 1.5 },

  table: { width: "100%", marginTop: 4 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  th: { padding: 6, fontSize: 9, fontWeight: "bold" },
  td: { padding: 6, fontSize: 9.5 },
  tdSub: { fontSize: 7.5, color: "#888888", marginTop: 1 },

  totalsWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  totalsBlock: { width: "58%" },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsLabel: { fontSize: 10, color: "#333333" },
  totalsValue: { fontSize: 10 },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1.5,
    borderTopColor: "#000000",
    marginTop: 4,
    paddingTop: 6,
  },
  balanceLabel: { fontSize: 12, fontWeight: "bold" },
  balanceValue: { fontSize: 12, fontWeight: "bold" },

  noteBox: {
    marginTop: 16,
    padding: 8,
    backgroundColor: "#f9f9f9",
    borderRadius: 4,
  },
  noteLabel: {
    fontSize: 8.5,
    fontWeight: "bold",
    marginBottom: 2,
    textTransform: "uppercase",
    color: "#666666",
  },
  noteText: { fontSize: 9.5, lineHeight: 1.4 },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    textAlign: "center",
    fontSize: 9,
    color: "#666666",
    borderTopWidth: 1,
    borderTopColor: "#000000",
    paddingTop: 8,
  },
});

/* ============================
   HELPERS
   ============================ */

const fmtMoney = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n || 0);

const fmtQty = (n) => {
  const v = parseFloat(n);
  return isNaN(v) ? "0" : String(v);
};

const fmtDate = (iso) => {
  if (!iso) return "";
  try {
    return format(new Date(iso), "d MMM yyyy, h:mm a");
  } catch {
    return "";
  }
};

const shortRef = (id) => (id ? id.slice(0, 8).toUpperCase() : "—");

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
  <View style={styles.table}>
    <View style={styles.tableHeaderRow} fixed>
      <View style={[styles.th, { width: "42%" }]}>
        <Text>Item</Text>
      </View>
      <View style={[styles.th, { width: "13%" }]}>
        <Text>Qty</Text>
      </View>
      <View style={[styles.th, { width: "13%" }]}>
        <Text>Unit</Text>
      </View>
      <View style={[styles.th, { width: "16%", textAlign: "right" }]}>
        <Text>Price</Text>
      </View>
      <View style={[styles.th, { width: "16%", textAlign: "right" }]}>
        <Text>Amount</Text>
      </View>
    </View>

    {items.map((it, i) => {
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.price) || 0;
      const lineTotal = qty * price;
      // Item names are stored as a " › "-joined catalog path (see
      // flattenPrice in this same modal) — show the leaf name as the line
      // item and the rest of the path as a small subtext, same convention
      // ItemViewRow uses on-screen.
      const parts = (it.name || "").split(" › ");
      const displayName = parts[parts.length - 1] || "Item";
      const categoryPath =
        parts.length > 1 ? parts.slice(0, -1).join(" › ") : "";

      return (
        <View key={i} style={styles.tableRow} wrap={false}>
          <View style={[styles.td, { width: "42%" }]}>
            <Text>{displayName}</Text>
            {categoryPath ? (
              <Text style={styles.tdSub}>{categoryPath}</Text>
            ) : null}
          </View>
          <View style={[styles.td, { width: "13%" }]}>
            <Text>{fmtQty(qty)}</Text>
          </View>
          <View style={[styles.td, { width: "13%" }]}>
            <Text>{it.unit || "-"}</Text>
          </View>
          <View style={[styles.td, { width: "16%", textAlign: "right" }]}>
            <Text>{fmtMoney(price)}</Text>
          </View>
          <View style={[styles.td, { width: "16%", textAlign: "right" }]}>
            <Text>{fmtMoney(lineTotal)}</Text>
          </View>
        </View>
      );
    })}

    {/* Additional amounts / discounts — label + amount only, no
        qty/unit/price breakdown, same as how the app itself shows these
        everywhere else (AddTransactionModal review step, etc). */}
    {extras.map((e, i) => {
      const amt = parseFloat(e.amount) || 0;
      return (
        <View key={`extra-${i}`} style={styles.tableRow} wrap={false}>
          <View style={[styles.td, { width: "68%" }]}>
            <Text>{e.name}</Text>
            {e.note ? <Text style={styles.tdSub}>{e.note}</Text> : null}
          </View>
          <View style={[styles.td, { width: "16%" }]} />
          <View style={[styles.td, { width: "16%", textAlign: "right" }]}>
            <Text>{fmtMoney(amt)}</Text>
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
    <View style={styles.table}>
      <View style={styles.tableHeaderRow} fixed>
        <View style={[styles.th, { width: "75%" }]}>
          <Text>Description</Text>
        </View>
        <View style={[styles.th, { width: "25%", textAlign: "right" }]}>
          <Text>Amount</Text>
        </View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.td, { width: "75%" }]}>
          <Text>{label}</Text>
        </View>
        <View style={[styles.td, { width: "25%", textAlign: "right" }]}>
          <Text>{fmtMoney(transaction.totalAmount)}</Text>
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
    balanceValue = fmtMoney(Math.abs(balance));
  } else {
    balanceLabel = "Balance Due";
    balanceValue = fmtMoney(balance);
  }

  const phone = primaryPhoneOf(contact);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.businessBlock}>
            <Text style={styles.businessName}>
              {business?.businessName || "Your Business"}
            </Text>
            {business?.businessAddress ? (
              <Text style={styles.businessLine}>
                {business.businessAddress}
              </Text>
            ) : null}
            {business?.phone ? (
              <Text style={styles.businessLine}>Ph: {business.phone}</Text>
            ) : null}
            {business?.email ? (
              <Text style={styles.businessLine}>{business.email}</Text>
            ) : null}
          </View>
          <View style={styles.docBlock}>
            <Text style={styles.docTitle}>{docLabel.toUpperCase()}</Text>
            <Text style={styles.docMetaLine}>
              Ref #{shortRef(transaction.id)}
            </Text>
            <Text style={styles.docMetaLine}>
              {fmtDate(transaction.createdAt)}
            </Text>
          </View>
        </View>

        {/* Bill To / Received From */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{partyLabel}</Text>
          {contact ? (
            <>
              <Text style={styles.partyName}>{contact.name}</Text>
              {phone ? <Text style={styles.partyLine}>{phone}</Text> : null}
              {contact.address ? (
                <Text style={styles.partyLine}>{contact.address}</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.partyName}>Walk-in customer</Text>
          )}
        </View>

        {/* Items, or the plain amount for a financial transaction */}
        {isItem ? (
          <ItemsTable items={items} extras={extras} />
        ) : (
          <FinancialTable transaction={transaction} />
        )}

        {/* Totals */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalsBlock}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Total</Text>
              <Text style={styles.totalsValue}>{fmtMoney(total)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Paid</Text>
              <Text style={styles.totalsValue}>{fmtMoney(paid)}</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>{balanceLabel}</Text>
              <Text style={styles.balanceValue}>{balanceValue}</Text>
            </View>
          </View>
        </View>

        {/* Note */}
        {transaction.note?.trim() ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Note</Text>
            <Text style={styles.noteText}>{transaction.note}</Text>
          </View>
        ) : null}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Generated with Vyaapaar • Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
};

/* ============================
   BLOB / FILE HELPERS
   ============================ */

const buildInvoiceFilename = (transaction) => {
  const label = transaction?.type === "out" ? "Invoice" : "Purchase-Bill";
  const ref = transaction?.id ? transaction.id.slice(0, 8) : "unknown";
  const dateSrc = transaction?.createdAt
    ? new Date(transaction.createdAt)
    : new Date();
  const dateStr = dateSrc.toISOString().slice(0, 10);
  return `${label}_${ref}_${dateStr}.pdf`;
};

const buildInvoiceBlob = ({ transaction, business, contact }) =>
  pdf(
    <InvoiceDocument
      transaction={transaction}
      business={business}
      contact={contact}
    />,
  ).toBlob();

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
