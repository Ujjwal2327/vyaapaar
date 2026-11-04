/**
 * lib/utils/gstInvoiceDocument.js
 *
 * v2 (consistency pass): look comes from the shared lib/utils/docTheme.js +
 * lib/utils/pdfTheme.js (same header, party block, fonts, colours, money/date
 * format and footer as the plain invoice and statement). Content, columns and
 * every figure are unchanged. The date prints as "4 Nov 2026" (IST) instead of
 * DD-MM-YYYY (GSTR-1 still uses DD-MM-YYYY).
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
  istParts,
  stateLabel,
} from "@/lib/utils/gstUtils";
import { COLORS, SIZE, fmtQty, money, num2 } from "@/lib/utils/docTheme";
import { PdfFooter, PdfHeader, S, W, right } from "@/lib/utils/pdfTheme";

// Only what is specific to a tax invoice lives here; everything else is S.
const T = StyleSheet.create({
  line: { fontSize: SIZE.cell, color: COLORS.text, marginBottom: 1.5 },
  words: { fontSize: SIZE.cell, lineHeight: 1.4, marginTop: 2 },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  wordsBlock: { width: "46%" },
  declRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.rule,
    paddingTop: 8,
  },
  declBlock: { width: "58%" },
  declText: { fontSize: SIZE.head, color: COLORS.text, lineHeight: 1.4 },
  signBlock: { width: "36%", alignItems: "flex-end" },
  signFor: { fontSize: SIZE.cell, fontWeight: "bold" },
  signLine: {
    marginTop: 30,
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: COLORS.rule,
    paddingTop: 3,
    textAlign: "center",
    fontSize: SIZE.head,
    color: COLORS.text,
  },
});

const pct = (r) => `${Number(Number(r).toFixed(3))}%`;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
// Invoice date in IST (the date the bill belongs to for GST), shown like every
// other document: "4 Nov 2026".
const invoiceDate = (iso) => {
  const { year, month, day } = istParts(iso);
  return `${day} ${MONTHS[month - 1]} ${year}`;
};

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
      <Page size="A4" style={S.page}>
        {/* Supplier + invoice identity */}
        <PdfHeader
          name={seller.name || "Your Business"}
          lines={[
            seller.address,
            seller.phone ? `Ph: ${seller.phone}` : null,
            { text: `GSTIN: ${seller.gstin}`, bold: true },
            `State: ${stateLabel(seller.stateCode)}`,
          ]}
          title="Tax Invoice"
          meta={[
            `Invoice No: ${tx.invoiceNo}`,
            `Date: ${invoiceDate(tx.createdAt)}`,
          ]}
        />

        {/* Recipient + supply details */}
        <View style={S.partyBox}>
          <View style={S.partyBoxCol}>
            <Text style={S.label}>Bill to</Text>
            <Text style={S.partyName}>{buyerName || "Walk-in customer"}</Text>
            {buyerAddress ? <Text style={T.line}>{buyerAddress}</Text> : null}
            <Text style={S.partyLineBold}>
              {buyerGstin ? `GSTIN: ${buyerGstin}` : "Unregistered (no GSTIN)"}
            </Text>
          </View>
          <View style={S.partyBoxColRight}>
            <Text style={S.label}>Supply details</Text>
            <Text style={T.line}>
              Place of supply: {stateLabel(gst.placeOfSupply) || "—"}
            </Text>
            <Text style={T.line}>
              {calc.intra
                ? "Intra-State supply (CGST + SGST)"
                : "Inter-State supply (IGST)"}
            </Text>
            <Text style={T.line}>Tax payable on reverse charge: No</Text>
            <Text style={T.line}>
              Rates are{" "}
              {gst.mode === "inclusive" ? "inclusive of" : "exclusive of"} GST
            </Text>
          </View>
        </View>

        {/* Line items */}
        <View style={S.table}>
          <View style={S.tableHeaderRow} fixed>
            <View style={[S.thDense, W(c.no)]}>
              <Text>#</Text>
            </View>
            <View style={[S.thDense, W(c.desc)]}>
              <Text>Description</Text>
            </View>
            <View style={[S.thDense, W(c.hsn)]}>
              <Text>HSN</Text>
            </View>
            <View style={[S.thDense, W(c.qty), right]}>
              <Text>Qty</Text>
            </View>
            <View style={[S.thDense, W(c.rate), right]}>
              <Text>{gst.mode === "inclusive" ? "Rate (incl.)" : "Rate"}</Text>
            </View>
            <View style={[S.thDense, W(c.taxable), right]}>
              <Text>Taxable value</Text>
            </View>
            {calc.intra ? (
              <>
                <View style={[S.thDense, W(c.a), right]}>
                  <Text>CGST</Text>
                </View>
                <View style={[S.thDense, W(c.b), right]}>
                  <Text>SGST</Text>
                </View>
              </>
            ) : (
              <View style={[S.thDense, W(c.a), right]}>
                <Text>IGST</Text>
              </View>
            )}
            <View style={[S.thDense, W(c.total), right]}>
              <Text>Amount</Text>
            </View>
          </View>

          {calc.lines.map((l, i) => {
            const parts = (l.name || "").split(" › ");
            const display = parts[parts.length - 1] || "Item";
            const path = parts.length > 1 ? parts.slice(0, -1).join(" › ") : "";
            return (
              <View key={i} style={S.tableRow} wrap={false}>
                <View style={[S.tdDense, W(c.no)]}>
                  <Text>{i + 1}</Text>
                </View>
                <View style={[S.tdDense, W(c.desc)]}>
                  <Text>{display}</Text>
                  {path ? <Text style={S.tdSubDense}>{path}</Text> : null}
                </View>
                <View style={[S.tdDense, W(c.hsn)]}>
                  <Text>{l.hsn || "—"}</Text>
                </View>
                <View style={[S.tdDense, W(c.qty), right]}>
                  <Text>{l.isExtra ? "" : fmtQty(l.quantity)}</Text>
                  {!l.isExtra && l.unit ? (
                    <Text style={S.tdSubDense}>{l.unit}</Text>
                  ) : null}
                </View>
                <View style={[S.tdDense, W(c.rate), right]}>
                  <Text>{l.isExtra ? "" : num2(l.price)}</Text>
                </View>
                <View style={[S.tdDense, W(c.taxable), right]}>
                  <Text>{num2(l.taxable)}</Text>
                </View>
                {calc.intra ? (
                  <>
                    <View style={[S.tdDense, W(c.a), right]}>
                      <Text>{num2(l.cgst)}</Text>
                      <Text style={S.tdSubDense}>@{pct(l.rate / 2)}</Text>
                    </View>
                    <View style={[S.tdDense, W(c.b), right]}>
                      <Text>{num2(l.sgst)}</Text>
                      <Text style={S.tdSubDense}>@{pct(l.rate / 2)}</Text>
                    </View>
                  </>
                ) : (
                  <View style={[S.tdDense, W(c.a), right]}>
                    <Text>{num2(l.igst)}</Text>
                    <Text style={S.tdSubDense}>@{pct(l.rate)}</Text>
                  </View>
                )}
                <View style={[S.tdDense, W(c.total), right]}>
                  <Text>{num2(l.total)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* HSN / rate-wise tax summary */}
        <Text style={S.sectionTitle}>Tax summary</Text>
        <View style={S.table}>
          <View style={S.tableHeaderRow}>
            <View style={[S.thDense, W(22)]}>
              <Text>HSN</Text>
            </View>
            <View style={[S.thDense, W(18), right]}>
              <Text>Taxable value</Text>
            </View>
            <View style={[S.thDense, W(10), right]}>
              <Text>Rate</Text>
            </View>
            {calc.intra ? (
              <>
                <View style={[S.thDense, W(16), right]}>
                  <Text>CGST</Text>
                </View>
                <View style={[S.thDense, W(16), right]}>
                  <Text>SGST</Text>
                </View>
              </>
            ) : (
              <View style={[S.thDense, W(32), right]}>
                <Text>IGST</Text>
              </View>
            )}
            <View style={[S.thDense, W(18), right]}>
              <Text>Total tax</Text>
            </View>
          </View>
          {calc.byHsn.map((g, i) => (
            <View key={i} style={S.tableRow} wrap={false}>
              <View style={[S.tdDense, W(22)]}>
                <Text>{g.hsn || "—"}</Text>
              </View>
              <View style={[S.tdDense, W(18), right]}>
                <Text>{num2(g.taxable)}</Text>
              </View>
              <View style={[S.tdDense, W(10), right]}>
                <Text>{pct(g.rate)}</Text>
              </View>
              {calc.intra ? (
                <>
                  <View style={[S.tdDense, W(16), right]}>
                    <Text>{num2(g.cgst)}</Text>
                  </View>
                  <View style={[S.tdDense, W(16), right]}>
                    <Text>{num2(g.sgst)}</Text>
                  </View>
                </>
              ) : (
                <View style={[S.tdDense, W(32), right]}>
                  <Text>{num2(g.igst)}</Text>
                </View>
              )}
              <View style={[S.tdDense, W(18), right]}>
                <Text>{num2(g.tax)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Totals + amount in words */}
        <View style={T.bottomRow} wrap={false}>
          <View style={T.wordsBlock}>
            <Text style={S.label}>Invoice value in words</Text>
            <Text style={T.words}>{amountInWords(calc.grandTotal)}</Text>
          </View>
          <View style={S.totalsBlock}>
            <View style={S.totalsRow}>
              <Text style={S.totalsLabel}>Taxable value</Text>
              <Text style={S.totalsValue}>{money(calc.taxable)}</Text>
            </View>
            {calc.intra ? (
              <>
                <View style={S.totalsRow}>
                  <Text style={S.totalsLabel}>CGST</Text>
                  <Text style={S.totalsValue}>{money(calc.cgst)}</Text>
                </View>
                <View style={S.totalsRow}>
                  <Text style={S.totalsLabel}>SGST</Text>
                  <Text style={S.totalsValue}>{money(calc.sgst)}</Text>
                </View>
              </>
            ) : (
              <View style={S.totalsRow}>
                <Text style={S.totalsLabel}>IGST</Text>
                <Text style={S.totalsValue}>{money(calc.igst)}</Text>
              </View>
            )}
            {Math.abs(calc.roundOff) > 0.004 && (
              <View style={S.totalsRow}>
                <Text style={S.totalsLabel}>Round off</Text>
                <Text style={S.totalsValue}>
                  {calc.roundOff < 0 ? "-" : "+"}
                  {money(Math.abs(calc.roundOff))}
                </Text>
              </View>
            )}
            <View style={S.grandRow}>
              <Text style={S.grandLabel}>Invoice total</Text>
              <Text style={S.grandValue}>{money(calc.grandTotal)}</Text>
            </View>
            <View style={S.totalsRow}>
              <Text style={S.totalsLabel}>Paid</Text>
              <Text style={S.totalsValue}>{money(paid)}</Text>
            </View>
            <View style={S.totalsRow}>
              <Text style={S.totalsLabel}>
                {settled
                  ? "Status"
                  : advance
                    ? "Advance / credit"
                    : "Balance due"}
              </Text>
              <Text style={S.totalsValue}>
                {settled ? "Settled" : money(Math.abs(balance))}
              </Text>
            </View>
          </View>
        </View>

        {tx.note?.trim() ? (
          <View style={S.noteBox}>
            <Text style={S.label}>Note</Text>
            <Text style={S.noteText}>{tx.note}</Text>
          </View>
        ) : null}

        {/* Declaration + signature */}
        <View style={T.declRow} wrap={false}>
          <View style={T.declBlock}>
            <Text style={S.label}>Declaration</Text>
            <Text style={T.declText}>
              We declare that this invoice shows the actual price of the goods
              described and that all particulars are true and correct.
            </Text>
          </View>
          <View style={T.signBlock}>
            <Text style={T.signFor}>For {seller.name || "the supplier"}</Text>
            <Text style={T.signLine}>Authorised signatory</Text>
          </View>
        </View>

        <PdfFooter prefix={`${tx.invoiceNo} • Computer generated invoice`} />
      </Page>
    </Document>
  );
};
