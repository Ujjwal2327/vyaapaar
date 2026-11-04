/**
 * lib/utils/gstInvoiceDocument.js
 *
 * The GST TAX INVOICE layout, used by lib/utils/invoicePdfGenerator.js for any
 * transaction that carries `gst`. Same fonts (registered over there) and the
 * same black-on-white look as the plain invoice; what it adds is what a tax
 * invoice has to show under Rule 46:
 *
 *   supplier name, address, GSTIN            ·  invoice number + date
 *   recipient name, address, GSTIN (if any)  ·  place of supply (with state code)
 *   per line: description, HSN, quantity, rate, taxable value, tax rate + amount
 *   CGST + SGST (same state) or IGST (other state), round-off, invoice value
 *   invoice value in words                   ·  reverse charge: No
 *   a signature block
 *
 * Seller and buyer come from the snapshot stored on the bill when it was
 * created, not from today's profile — an invoice has to keep saying what it
 * said when it was issued, even if the shop later changes its address or the
 * contact is renamed.
 *
 * Every figure is read from computeGstForTx, the same function that set the
 * bill's total, so the PDF can't disagree with the ledger.
 */

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  amountInWords,
  computeGstForTx,
  gstDate,
  stateLabel,
} from "@/lib/utils/gstUtils";

const styles = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingLeft: 22,
    paddingRight: 22,
    paddingBottom: 46,
    fontFamily: "Ubuntu",
    fallbackFont: "Helvetica",
    fontSize: 9,
    backgroundColor: "#ffffff",
    color: "#000000",
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#000000",
    paddingBottom: 10,
    marginBottom: 10,
  },
  sellerBlock: { width: "60%" },
  sellerName: { fontSize: 15, fontWeight: "bold", marginBottom: 3 },
  line: { fontSize: 9, color: "#333333", marginBottom: 1.5 },
  lineBold: { fontSize: 9.5, fontWeight: "bold", marginBottom: 1.5 },
  docBlock: { width: "36%", alignItems: "flex-end" },
  docTitle: { fontSize: 17, fontWeight: "bold", marginBottom: 5 },
  docMeta: { fontSize: 9.5, marginBottom: 2, textAlign: "right" },

  partyRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 10,
  },
  partyCol: { width: "50%", padding: 7 },
  partyColRight: {
    width: "50%",
    padding: 7,
    borderLeftWidth: 1,
    borderLeftColor: "#000000",
  },
  label: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#666666",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  partyName: { fontSize: 11, fontWeight: "bold", marginBottom: 2 },

  table: { width: "100%", marginTop: 2 },
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
    fontSize: 8,
    fontWeight: "bold",
  },
  td: { paddingVertical: 5, paddingHorizontal: 4, fontSize: 8.5 },
  sub: { fontSize: 7, color: "#777777", marginTop: 1 },

  sectionTitle: {
    fontSize: 8.5,
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 3,
    textTransform: "uppercase",
    color: "#444444",
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  wordsBlock: { width: "52%" },
  words: { fontSize: 9, lineHeight: 1.4, marginTop: 2 },
  totalsBlock: { width: "44%" },
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
    marginTop: 12,
    padding: 7,
    backgroundColor: "#f9f9f9",
    borderRadius: 3,
  },
  noteText: { fontSize: 9, lineHeight: 1.4 },

  declRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#000000",
    paddingTop: 8,
  },
  declBlock: { width: "58%" },
  declText: { fontSize: 8, color: "#444444", lineHeight: 1.4 },
  signBlock: { width: "36%", alignItems: "flex-end" },
  signFor: { fontSize: 9, fontWeight: "bold" },
  signLine: {
    marginTop: 30,
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#000000",
    paddingTop: 3,
    textAlign: "center",
    fontSize: 8,
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

// Column widths (%) — intra-state shows CGST + SGST side by side, inter-state one IGST column.
const COLS = {
  intra: {
    no: 4,
    desc: 25,
    hsn: 8,
    qty: 9,
    rate: 10,
    taxable: 11,
    a: 11,
    b: 11,
    total: 11,
  },
  inter: {
    no: 4,
    desc: 28,
    hsn: 9,
    qty: 10,
    rate: 11,
    taxable: 12,
    a: 13,
    b: 0,
    total: 13,
  },
};

const W = (p) => ({ width: `${p}%` });
const right = { textAlign: "right" };

export const GstInvoiceDocument = ({ transaction: tx, contact }) => {
  const gst = tx.gst;
  const calc = computeGstForTx(tx);
  const c = calc.intra ? COLS.intra : COLS.inter;

  const seller = gst.seller ?? {};
  const buyer = gst.buyer ?? {};
  const buyerName = buyer.name || contact?.name || "";
  const buyerAddress = buyer.address || contact?.address || "";
  const buyerGstin = buyer.gstin || "";

  const paid = Number(tx.paidAmount) || 0;
  const balance = Math.round((calc.grandTotal - paid) * 100) / 100;
  const settled = Math.abs(balance) < 0.01;
  const advance = balance < -0.01;

  return (
    <Document title={`Tax Invoice ${tx.invoiceNo}`}>
      <Page size="A4" style={styles.page}>
        {/* Supplier + invoice identity */}
        <View style={styles.headerRow}>
          <View style={styles.sellerBlock}>
            <Text style={styles.sellerName}>
              {seller.name || "Your Business"}
            </Text>
            {seller.address ? (
              <Text style={styles.line}>{seller.address}</Text>
            ) : null}
            {seller.phone ? (
              <Text style={styles.line}>Ph: {seller.phone}</Text>
            ) : null}
            <Text style={styles.lineBold}>GSTIN: {seller.gstin}</Text>
            <Text style={styles.line}>
              State: {stateLabel(seller.stateCode)}
            </Text>
          </View>
          <View style={styles.docBlock}>
            <Text style={styles.docTitle}>TAX INVOICE</Text>
            <Text style={styles.docMeta}>Invoice No: {tx.invoiceNo}</Text>
            <Text style={styles.docMeta}>Date: {gstDate(tx.createdAt)}</Text>
          </View>
        </View>

        {/* Recipient + supply details */}
        <View style={styles.partyRow}>
          <View style={styles.partyCol}>
            <Text style={styles.label}>Bill to</Text>
            <Text style={styles.partyName}>
              {buyerName || "Walk-in customer"}
            </Text>
            {buyerAddress ? (
              <Text style={styles.line}>{buyerAddress}</Text>
            ) : null}
            <Text style={styles.lineBold}>
              {buyerGstin ? `GSTIN: ${buyerGstin}` : "Unregistered (no GSTIN)"}
            </Text>
          </View>
          <View style={styles.partyColRight}>
            <Text style={styles.label}>Supply details</Text>
            <Text style={styles.line}>
              Place of supply: {stateLabel(gst.placeOfSupply) || "—"}
            </Text>
            <Text style={styles.line}>
              {calc.intra
                ? "Intra-State supply (CGST + SGST)"
                : "Inter-State supply (IGST)"}
            </Text>
            <Text style={styles.line}>Tax payable on reverse charge: No</Text>
            <Text style={styles.line}>
              Rates are{" "}
              {gst.mode === "inclusive" ? "inclusive of" : "exclusive of"} GST
            </Text>
          </View>
        </View>

        {/* Line items */}
        <View style={styles.table}>
          <View style={styles.headRow} fixed>
            <View style={[styles.th, W(c.no)]}>
              <Text>#</Text>
            </View>
            <View style={[styles.th, W(c.desc)]}>
              <Text>Description</Text>
            </View>
            <View style={[styles.th, W(c.hsn)]}>
              <Text>HSN</Text>
            </View>
            <View style={[styles.th, W(c.qty), right]}>
              <Text>Qty</Text>
            </View>
            <View style={[styles.th, W(c.rate), right]}>
              <Text>{gst.mode === "inclusive" ? "Rate (incl.)" : "Rate"}</Text>
            </View>
            <View style={[styles.th, W(c.taxable), right]}>
              <Text>Taxable value</Text>
            </View>
            {calc.intra ? (
              <>
                <View style={[styles.th, W(c.a), right]}>
                  <Text>CGST</Text>
                </View>
                <View style={[styles.th, W(c.b), right]}>
                  <Text>SGST</Text>
                </View>
              </>
            ) : (
              <View style={[styles.th, W(c.a), right]}>
                <Text>IGST</Text>
              </View>
            )}
            <View style={[styles.th, W(c.total), right]}>
              <Text>Amount</Text>
            </View>
          </View>

          {calc.lines.map((l, i) => {
            const parts = (l.name || "").split(" › ");
            const display = parts[parts.length - 1] || "Item";
            const path = parts.length > 1 ? parts.slice(0, -1).join(" › ") : "";
            return (
              <View key={i} style={styles.row} wrap={false}>
                <View style={[styles.td, W(c.no)]}>
                  <Text>{i + 1}</Text>
                </View>
                <View style={[styles.td, W(c.desc)]}>
                  <Text>{display}</Text>
                  {path ? <Text style={styles.sub}>{path}</Text> : null}
                </View>
                <View style={[styles.td, W(c.hsn)]}>
                  <Text>{l.hsn || "—"}</Text>
                </View>
                <View style={[styles.td, W(c.qty), right]}>
                  <Text>{l.isExtra ? "" : fmtQty(l.quantity)}</Text>
                  {!l.isExtra && l.unit ? (
                    <Text style={styles.sub}>{l.unit}</Text>
                  ) : null}
                </View>
                <View style={[styles.td, W(c.rate), right]}>
                  <Text>{l.isExtra ? "" : num2(l.price)}</Text>
                </View>
                <View style={[styles.td, W(c.taxable), right]}>
                  <Text>{num2(l.taxable)}</Text>
                </View>
                {calc.intra ? (
                  <>
                    <View style={[styles.td, W(c.a), right]}>
                      <Text>{num2(l.cgst)}</Text>
                      <Text style={styles.sub}>@{pct(l.rate / 2)}</Text>
                    </View>
                    <View style={[styles.td, W(c.b), right]}>
                      <Text>{num2(l.sgst)}</Text>
                      <Text style={styles.sub}>@{pct(l.rate / 2)}</Text>
                    </View>
                  </>
                ) : (
                  <View style={[styles.td, W(c.a), right]}>
                    <Text>{num2(l.igst)}</Text>
                    <Text style={styles.sub}>@{pct(l.rate)}</Text>
                  </View>
                )}
                <View style={[styles.td, W(c.total), right]}>
                  <Text>{num2(l.total)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* HSN / rate-wise tax summary */}
        <Text style={styles.sectionTitle}>Tax summary</Text>
        <View style={styles.table}>
          <View style={styles.headRow}>
            <View style={[styles.th, W(22)]}>
              <Text>HSN</Text>
            </View>
            <View style={[styles.th, W(18), right]}>
              <Text>Taxable value</Text>
            </View>
            <View style={[styles.th, W(10), right]}>
              <Text>Rate</Text>
            </View>
            {calc.intra ? (
              <>
                <View style={[styles.th, W(16), right]}>
                  <Text>CGST</Text>
                </View>
                <View style={[styles.th, W(16), right]}>
                  <Text>SGST</Text>
                </View>
              </>
            ) : (
              <View style={[styles.th, W(32), right]}>
                <Text>IGST</Text>
              </View>
            )}
            <View style={[styles.th, W(18), right]}>
              <Text>Total tax</Text>
            </View>
          </View>
          {calc.byHsn.map((g, i) => (
            <View key={i} style={styles.row} wrap={false}>
              <View style={[styles.td, W(22)]}>
                <Text>{g.hsn || "—"}</Text>
              </View>
              <View style={[styles.td, W(18), right]}>
                <Text>{num2(g.taxable)}</Text>
              </View>
              <View style={[styles.td, W(10), right]}>
                <Text>{pct(g.rate)}</Text>
              </View>
              {calc.intra ? (
                <>
                  <View style={[styles.td, W(16), right]}>
                    <Text>{num2(g.cgst)}</Text>
                  </View>
                  <View style={[styles.td, W(16), right]}>
                    <Text>{num2(g.sgst)}</Text>
                  </View>
                </>
              ) : (
                <View style={[styles.td, W(32), right]}>
                  <Text>{num2(g.igst)}</Text>
                </View>
              )}
              <View style={[styles.td, W(18), right]}>
                <Text>{num2(g.tax)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Totals + amount in words */}
        <View style={styles.bottomRow} wrap={false}>
          <View style={styles.wordsBlock}>
            <Text style={styles.label}>Invoice value in words</Text>
            <Text style={styles.words}>{amountInWords(calc.grandTotal)}</Text>
          </View>
          <View style={styles.totalsBlock}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Taxable value</Text>
              <Text style={styles.totalsValue}>{money(calc.taxable)}</Text>
            </View>
            {calc.intra ? (
              <>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>CGST</Text>
                  <Text style={styles.totalsValue}>{money(calc.cgst)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>SGST</Text>
                  <Text style={styles.totalsValue}>{money(calc.sgst)}</Text>
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
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>Invoice total</Text>
              <Text style={styles.grandValue}>{money(calc.grandTotal)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Paid</Text>
              <Text style={styles.totalsValue}>{money(paid)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                {settled
                  ? "Status"
                  : advance
                    ? "Advance / credit"
                    : "Balance due"}
              </Text>
              <Text style={styles.totalsValue}>
                {settled ? "Settled" : money(Math.abs(balance))}
              </Text>
            </View>
          </View>
        </View>

        {tx.note?.trim() ? (
          <View style={styles.noteBox}>
            <Text style={styles.label}>Note</Text>
            <Text style={styles.noteText}>{tx.note}</Text>
          </View>
        ) : null}

        {/* Declaration + signature */}
        <View style={styles.declRow} wrap={false}>
          <View style={styles.declBlock}>
            <Text style={styles.label}>Declaration</Text>
            <Text style={styles.declText}>
              We declare that this invoice shows the actual price of the goods
              described and that all particulars are true and correct.
            </Text>
          </View>
          <View style={styles.signBlock}>
            <Text style={styles.signFor}>
              For {seller.name || "the supplier"}
            </Text>
            <Text style={styles.signLine}>Authorised signatory</Text>
          </View>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${tx.invoiceNo} • Computer generated invoice • Generated with Vyaapaar • Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
};
