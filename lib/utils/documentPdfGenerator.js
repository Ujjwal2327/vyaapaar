/**
 * lib/utils/documentPdfGenerator.js
 *
 * PDF for a quotation or a delivery challan. Same fonts and black-on-white
 * look as lib/utils/invoicePdfGenerator.js.
 *
 *  - Quotation: items with rate and amount, totals, validity date. For a GST
 *    document it also shows HSN, GST rate and the CGST/SGST or IGST split.
 *    It says clearly that it is not a tax invoice.
 *  - Delivery challan: quantities only by default (a challan accompanies goods
 *    in transit; it isn't a bill) with a "received by" signature block.
 *    `showPrices` adds rates and amounts if the shop wants them on it.
 *
 * Imported lazily (dynamic import) by the detail modal so @react-pdf/renderer
 * stays out of the page bundle until someone downloads one.
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
import {
  computeGstForTx,
  invoiceFileStem,
  stateLabel,
} from "@/lib/utils/gstUtils";
import { docRef, lineAmount, typeInfo } from "@/lib/utils/documentUtils";

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
    paddingTop: 22,
    paddingLeft: 22,
    paddingRight: 22,
    paddingBottom: 46,
    fontFamily: "Ubuntu",
    fallbackFont: "Helvetica",
    fontSize: 9.5,
    backgroundColor: "#ffffff",
    color: "#000000",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#000000",
    paddingBottom: 10,
    marginBottom: 12,
  },
  bizBlock: { maxWidth: "58%" },
  bizName: { fontSize: 17, fontWeight: "bold", marginBottom: 3 },
  line: { fontSize: 9.5, color: "#333333", marginBottom: 1.5 },
  lineBold: { fontSize: 9.5, fontWeight: "bold", marginBottom: 1.5 },
  docBlock: { maxWidth: "38%", alignItems: "flex-end" },
  docTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
    textAlign: "right",
  },
  docMeta: { fontSize: 9.5, marginBottom: 2, textAlign: "right" },

  section: { marginBottom: 12 },
  label: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#666666",
    marginBottom: 3,
    textTransform: "uppercase",
  },
  partyName: { fontSize: 12.5, fontWeight: "bold", marginBottom: 2 },

  table: { width: "100%", marginTop: 4 },
  headRow: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderTopWidth: 1,
    borderTopColor: "#000000",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  th: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 8.5,
    fontWeight: "bold",
  },
  td: { paddingVertical: 5, paddingHorizontal: 4, fontSize: 9 },
  sub: { fontSize: 7.5, color: "#777777", marginTop: 1 },

  totalsWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  totalsBlock: { width: "52%" },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
  },
  totalsLabel: { fontSize: 9.5, color: "#333333" },
  totalsValue: { fontSize: 9.5 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1.5,
    borderTopColor: "#000000",
    marginTop: 3,
    paddingTop: 5,
  },
  grandLabel: { fontSize: 11.5, fontWeight: "bold" },
  grandValue: { fontSize: 11.5, fontWeight: "bold" },

  noteBox: {
    marginTop: 14,
    padding: 7,
    backgroundColor: "#f9f9f9",
    borderRadius: 3,
  },
  noteText: { fontSize: 9, lineHeight: 1.4 },
  disclaimer: {
    marginTop: 14,
    fontSize: 8.5,
    color: "#555555",
    lineHeight: 1.4,
  },

  signRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 34,
    gap: 30,
  },
  signBox: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: "#000000",
    paddingTop: 3,
    textAlign: "center",
    fontSize: 8.5,
    color: "#444444",
  },

  footer: {
    position: "absolute",
    bottom: 18,
    left: 22,
    right: 22,
    textAlign: "center",
    fontSize: 8,
    color: "#666666",
    borderTopWidth: 1,
    borderTopColor: "#000000",
    paddingTop: 6,
  },
});

const num2 = (n) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
const money = (n) => `₹${num2(n)}`;
const fmtQty = (n) => String(Number(Number(n).toFixed(4)));
const pct = (r) => `${Number(Number(r).toFixed(3))}%`;
const safeDate = (iso, pattern) => {
  try {
    return format(new Date(iso), pattern);
  } catch {
    return "";
  }
};

const W = (p) => ({ width: `${p}%` });
const right = { textAlign: "right" };

const leaf = (name) => {
  const parts = (name || "").split(" › ");
  return {
    display: parts[parts.length - 1] || "Item",
    path: parts.length > 1 ? parts.slice(0, -1).join(" › ") : "",
  };
};

// ─── tables ──────────────────────────────────────────────────────────────────

// Quantities only — the challan default.
const QtyTable = ({ items }) => (
  <View style={styles.table}>
    <View style={styles.headRow} fixed>
      <View style={[styles.th, W(8)]}>
        <Text>#</Text>
      </View>
      <View style={[styles.th, W(62)]}>
        <Text>Item</Text>
      </View>
      <View style={[styles.th, W(15), right]}>
        <Text>Qty</Text>
      </View>
      <View style={[styles.th, W(15)]}>
        <Text>Unit</Text>
      </View>
    </View>
    {items.map((l, i) => {
      const { display, path } = leaf(l.name);
      return (
        <View key={i} style={styles.row} wrap={false}>
          <View style={[styles.td, W(8)]}>
            <Text>{i + 1}</Text>
          </View>
          <View style={[styles.td, W(62)]}>
            <Text>{display}</Text>
            {path ? <Text style={styles.sub}>{path}</Text> : null}
          </View>
          <View style={[styles.td, W(15), right]}>
            <Text>{fmtQty(l.quantity)}</Text>
          </View>
          <View style={[styles.td, W(15)]}>
            <Text>{l.unit || "-"}</Text>
          </View>
        </View>
      );
    })}
  </View>
);

// Priced, no tax split.
const PricedTable = ({ items, extras }) => (
  <View style={styles.table}>
    <View style={styles.headRow} fixed>
      <View style={[styles.th, W(6)]}>
        <Text>#</Text>
      </View>
      <View style={[styles.th, W(40)]}>
        <Text>Item</Text>
      </View>
      <View style={[styles.th, W(12), right]}>
        <Text>Qty</Text>
      </View>
      <View style={[styles.th, W(10)]}>
        <Text>Unit</Text>
      </View>
      <View style={[styles.th, W(15), right]}>
        <Text>Rate</Text>
      </View>
      <View style={[styles.th, W(17), right]}>
        <Text>Amount</Text>
      </View>
    </View>
    {items.map((l, i) => {
      const { display, path } = leaf(l.name);
      return (
        <View key={i} style={styles.row} wrap={false}>
          <View style={[styles.td, W(6)]}>
            <Text>{i + 1}</Text>
          </View>
          <View style={[styles.td, W(40)]}>
            <Text>{display}</Text>
            {path ? <Text style={styles.sub}>{path}</Text> : null}
          </View>
          <View style={[styles.td, W(12), right]}>
            <Text>{fmtQty(l.quantity)}</Text>
          </View>
          <View style={[styles.td, W(10)]}>
            <Text>{l.unit || "-"}</Text>
          </View>
          <View style={[styles.td, W(15), right]}>
            <Text>{num2(parseFloat(l.price) || 0)}</Text>
          </View>
          <View style={[styles.td, W(17), right]}>
            <Text>{num2(lineAmount(l))}</Text>
          </View>
        </View>
      );
    })}
    {extras.map((e, i) => (
      <View key={`x${i}`} style={styles.row} wrap={false}>
        <View style={[styles.td, W(83)]}>
          <Text>{e.name}</Text>
          {e.note ? <Text style={styles.sub}>{e.note}</Text> : null}
        </View>
        <View style={[styles.td, W(17), right]}>
          <Text>{num2(parseFloat(e.amount) || 0)}</Text>
        </View>
      </View>
    ))}
  </View>
);

// Priced with HSN + GST rate (GST documents).
const GstTable = ({ calc }) => (
  <View style={styles.table}>
    <View style={styles.headRow} fixed>
      <View style={[styles.th, W(5)]}>
        <Text>#</Text>
      </View>
      <View style={[styles.th, W(33)]}>
        <Text>Description</Text>
      </View>
      <View style={[styles.th, W(10)]}>
        <Text>HSN</Text>
      </View>
      <View style={[styles.th, W(11), right]}>
        <Text>Qty</Text>
      </View>
      <View style={[styles.th, W(13), right]}>
        <Text>Rate</Text>
      </View>
      <View style={[styles.th, W(8), right]}>
        <Text>GST</Text>
      </View>
      <View style={[styles.th, W(20), right]}>
        <Text>Amount</Text>
      </View>
    </View>
    {calc.lines.map((l, i) => {
      const { display, path } = leaf(l.name);
      return (
        <View key={i} style={styles.row} wrap={false}>
          <View style={[styles.td, W(5)]}>
            <Text>{i + 1}</Text>
          </View>
          <View style={[styles.td, W(33)]}>
            <Text>{display}</Text>
            {path ? <Text style={styles.sub}>{path}</Text> : null}
          </View>
          <View style={[styles.td, W(10)]}>
            <Text>{l.hsn || "—"}</Text>
          </View>
          <View style={[styles.td, W(11), right]}>
            <Text>{l.isExtra ? "" : fmtQty(l.quantity)}</Text>
            {!l.isExtra && l.unit ? (
              <Text style={styles.sub}>{l.unit}</Text>
            ) : null}
          </View>
          <View style={[styles.td, W(13), right]}>
            <Text>{l.isExtra ? "" : num2(l.price)}</Text>
          </View>
          <View style={[styles.td, W(8), right]}>
            <Text>{pct(l.rate)}</Text>
          </View>
          <View style={[styles.td, W(20), right]}>
            <Text>{num2(l.total)}</Text>
          </View>
        </View>
      );
    })}
  </View>
);

// ─── document ────────────────────────────────────────────────────────────────

const DocumentPdf = ({ doc, business, showPrices }) => {
  const info = typeInfo(doc.docType);
  const isChallan = doc.docType === "challan";
  const prices = !isChallan || showPrices;
  const useGstLayout = prices && !!doc.gst;
  const calc = useGstLayout ? computeGstForTx(doc) : null;

  const items = (doc.itemsList ?? []).filter((l) => l?.name?.trim());
  const extras = (doc.additionalAmounts ?? []).filter((e) => e?.name?.trim());
  const itemsTotal = items.reduce((s, l) => s + lineAmount(l), 0);
  const extrasTotal = extras.reduce(
    (s, e) => s + (parseFloat(e.amount) || 0),
    0,
  );
  const total = calc ? calc.grandTotal : itemsTotal + extrasTotal;

  const party = doc.party ?? {};
  const seller = doc.gst?.seller;
  const bizName = business?.businessName || seller?.name || "Your Business";
  const bizGstin = business?.gstin || seller?.gstin;

  return (
    <Document title={`${info.label} ${docRef(doc)}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.bizBlock}>
            <Text style={styles.bizName}>{bizName}</Text>
            {business?.businessAddress ? (
              <Text style={styles.line}>{business.businessAddress}</Text>
            ) : null}
            {business?.phone ? (
              <Text style={styles.line}>Ph: {business.phone}</Text>
            ) : null}
            {business?.email ? (
              <Text style={styles.line}>{business.email}</Text>
            ) : null}
            {doc.gst && bizGstin ? (
              <Text style={styles.lineBold}>GSTIN: {bizGstin}</Text>
            ) : null}
          </View>
          <View style={styles.docBlock}>
            <Text style={styles.docTitle}>{info.pdfTitle}</Text>
            <Text style={styles.docMeta}>No: {docRef(doc)}</Text>
            <Text style={styles.docMeta}>
              Date: {safeDate(doc.createdAt, "d MMM yyyy")}
            </Text>
            {doc.docType === "quotation" && doc.validUntil ? (
              <Text style={styles.docMeta}>
                Valid until:{" "}
                {safeDate(`${doc.validUntil}T00:00:00`, "d MMM yyyy")}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>
            {isChallan ? "Deliver to" : "Quotation for"}
          </Text>
          <Text style={styles.partyName}>
            {party.name?.trim() || "Walk-in customer"}
          </Text>
          {party.phone ? <Text style={styles.line}>{party.phone}</Text> : null}
          {party.address ? (
            <Text style={styles.line}>{party.address}</Text>
          ) : null}
          {doc.gst?.buyer?.gstin ? (
            <Text style={styles.lineBold}>GSTIN: {doc.gst.buyer.gstin}</Text>
          ) : null}
          {useGstLayout && doc.gst.placeOfSupply ? (
            <Text style={styles.line}>
              Place of supply: {stateLabel(doc.gst.placeOfSupply)}
            </Text>
          ) : null}
        </View>

        {!prices ? (
          <QtyTable items={items} />
        ) : useGstLayout ? (
          <GstTable calc={calc} />
        ) : (
          <PricedTable items={items} extras={extras} />
        )}

        {prices && (
          <View style={styles.totalsWrap} wrap={false}>
            <View style={styles.totalsBlock}>
              {calc ? (
                <>
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>Taxable value</Text>
                    <Text style={styles.totalsValue}>
                      {money(calc.taxable)}
                    </Text>
                  </View>
                  {calc.intra ? (
                    <>
                      <View style={styles.totalsRow}>
                        <Text style={styles.totalsLabel}>CGST</Text>
                        <Text style={styles.totalsValue}>
                          {money(calc.cgst)}
                        </Text>
                      </View>
                      <View style={styles.totalsRow}>
                        <Text style={styles.totalsLabel}>SGST</Text>
                        <Text style={styles.totalsValue}>
                          {money(calc.sgst)}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.totalsRow}>
                      <Text style={styles.totalsLabel}>IGST</Text>
                      <Text style={styles.totalsValue}>{money(calc.igst)}</Text>
                    </View>
                  )}
                  {Math.abs(calc.roundOff) > 0.004 && (
                    <View style={styles.totalsRow}>
                      <Text style={styles.totalsLabel}>Round off</Text>
                      <Text style={styles.totalsValue}>
                        {calc.roundOff < 0 ? "-" : "+"}
                        {money(Math.abs(calc.roundOff))}
                      </Text>
                    </View>
                  )}
                </>
              ) : null}
              <View style={styles.grandRow}>
                <Text style={styles.grandLabel}>
                  {isChallan ? "Value of goods" : "Total"}
                </Text>
                <Text style={styles.grandValue}>{money(total)}</Text>
              </View>
            </View>
          </View>
        )}

        {doc.note?.trim() ? (
          <View style={styles.noteBox}>
            <Text style={styles.label}>Note</Text>
            <Text style={styles.noteText}>{doc.note}</Text>
          </View>
        ) : null}

        <Text style={styles.disclaimer}>
          {isChallan
            ? "This is a delivery challan for goods sent. It is not an invoice and no payment is due against it."
            : "This is a quotation, not an invoice. Prices are as quoted on the date above" +
              (doc.validUntil ? " and valid until the date shown." : ".") +
              (doc.gst
                ? " GST is shown as applicable at the time of quotation."
                : "")}
        </Text>

        <View style={styles.signRow} wrap={false}>
          {isChallan ? (
            <Text style={styles.signBox}>Received by (name & signature)</Text>
          ) : null}
          <Text style={styles.signBox}>For {bizName}</Text>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${docRef(doc)} • Generated with Vyaapaar • Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
};

// ─── exports ─────────────────────────────────────────────────────────────────

const buildBlob = ({ doc, business, showPrices }) =>
  pdf(
    <DocumentPdf doc={doc} business={business} showPrices={showPrices} />,
  ).toBlob();

const filenameFor = (doc) =>
  `${typeInfo(doc.docType).label.replace(/\s+/g, "-")}_${invoiceFileStem(docRef(doc))}.pdf`;

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

export const downloadDocumentPdf = async ({
  doc,
  business,
  showPrices = true,
}) => {
  const blob = await buildBlob({ doc, business, showPrices });
  downloadBlob(blob, filenameFor(doc));
};

/** Share sheet first (WhatsApp / email as a real attachment), download as fallback. */
export const shareDocumentPdf = async ({
  doc,
  business,
  showPrices = true,
}) => {
  const blob = await buildBlob({ doc, business, showPrices });
  const filename = filenameFor(doc);
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
    }
  }
  downloadBlob(blob, filename);
  return { method: "download" };
};
