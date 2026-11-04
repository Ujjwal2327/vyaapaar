/**
 * lib/utils/pdfTheme.js   (NEW)
 *
 * The react-pdf half of the shared document look (numbers live in
 * lib/utils/docTheme.js). Every PDF the app makes imports from here:
 *
 *   - registers the Ubuntu font ONCE (it used to be registered separately in
 *     three files),
 *   - one StyleSheet (`S`) for page, header, party block, tables, totals,
 *     notes and footer,
 *   - <PdfHeader/> and <PdfFooter/> so the top and bottom of every document
 *     are the same component, not four near-copies,
 *   - small helpers for column widths.
 *
 * Imported lazily by the PDF generators, so @react-pdf/renderer stays out of
 * the main bundle exactly as before.
 */

import React from "react";
import { Font, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  COLORS,
  FONT_FALLBACK,
  FONT_FAMILY,
  PAGE,
  SIZE,
  WIDTH,
  footerText,
} from "@/lib/utils/docTheme";

Font.register({
  family: FONT_FAMILY,
  fonts: [
    { src: "/fonts/Ubuntu-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Ubuntu-Medium.ttf", fontWeight: "500" },
    { src: "/fonts/Ubuntu-Bold.ttf", fontWeight: "bold" },
  ],
});

// Never split a word with a hyphen at the end of a line — names, addresses and
// item names look wrong broken as "Plum-bing" (react-pdf hyphenates by default).
Font.registerHyphenationCallback((word) => [word]);

export const S = StyleSheet.create({
  /* ---------- page ---------- */
  page: {
    paddingTop: PAGE.margin,
    paddingLeft: PAGE.margin,
    paddingRight: PAGE.margin,
    paddingBottom: PAGE.bottom,
    fontFamily: FONT_FAMILY,
    fallbackFont: FONT_FALLBACK,
    fontSize: SIZE.body,
    backgroundColor: "#ffffff",
    color: COLORS.ink,
  },

  /* ---------- header: shop on the left, document identity on the right ---------- */
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.rule,
    paddingBottom: 12,
  },
  businessBlock: { width: WIDTH.business },
  businessName: { fontSize: SIZE.bizName, fontWeight: "bold", marginBottom: 4 },
  businessLine: { fontSize: SIZE.cell, color: COLORS.text, marginBottom: 2 },
  businessLineBold: {
    fontSize: SIZE.cell,
    fontWeight: "bold",
    marginBottom: 2,
  },
  docBlock: { width: WIDTH.doc, alignItems: "flex-end" },
  docTitle: { fontSize: SIZE.docTitle, fontWeight: "bold", marginBottom: 6 },
  docMetaLine: {
    fontSize: SIZE.cell,
    color: COLORS.text,
    marginBottom: 2,
    textAlign: "right",
  },

  /* ---------- party (bill to / account of / received from) ---------- */
  section: { marginBottom: 14 },
  label: {
    fontSize: SIZE.label,
    fontWeight: "bold",
    color: COLORS.muted,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  partyName: { fontSize: SIZE.party, fontWeight: "bold", marginBottom: 2 },
  partyLine: { fontSize: SIZE.body, color: COLORS.text, marginBottom: 1.5 },
  partyLineBold: {
    fontSize: SIZE.body,
    fontWeight: "bold",
    marginBottom: 1.5,
  },
  // Two-column bordered box (tax invoice: bill-to | supply details)
  partyBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLORS.rule,
    marginBottom: 14,
  },
  partyBoxCol: { width: "50%", padding: 8 },
  partyBoxColRight: {
    width: "50%",
    padding: 8,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.rule,
  },

  /* ---------- tables ---------- */
  table: { width: "100%", marginTop: 4 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: COLORS.headBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.rule,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.rule,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  th: { padding: 6, fontSize: SIZE.head, fontWeight: "bold" },
  td: { padding: 6, fontSize: SIZE.cell },
  tdSub: { fontSize: SIZE.sub, color: COLORS.faint, marginTop: 1 },
  // dense variant: same look, one notch smaller (GST tax invoice)
  thDense: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: SIZE.denseHead,
    fontWeight: "bold",
  },
  tdDense: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: SIZE.denseCell,
  },
  tdSubDense: { fontSize: SIZE.denseSub, color: COLORS.faint, marginTop: 1 },
  sectionTitle: {
    fontSize: SIZE.label,
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 3,
    textTransform: "uppercase",
    color: COLORS.muted,
  },

  /* ---------- totals ---------- */
  totalsWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  totalsBlock: { width: WIDTH.totals },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsLabel: { fontSize: SIZE.totals, color: COLORS.text },
  totalsValue: { fontSize: SIZE.totals },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1.5,
    borderTopColor: COLORS.rule,
    marginTop: 4,
    paddingTop: 6,
  },
  grandLabel: { fontSize: SIZE.grand, fontWeight: "bold" },
  grandValue: { fontSize: SIZE.grand, fontWeight: "bold" },

  /* ---------- note / misc ---------- */
  noteBox: {
    marginTop: 14,
    padding: 8,
    backgroundColor: COLORS.boxBg,
    borderRadius: 4,
  },
  noteText: { fontSize: SIZE.note, lineHeight: 1.4 },
  empty: { fontSize: SIZE.body, color: COLORS.muted, marginTop: 10 },
  smallText: { fontSize: SIZE.cell, lineHeight: 1.4 },

  /* ---------- footer ---------- */
  footer: {
    position: "absolute",
    bottom: PAGE.footerBottom,
    left: PAGE.margin,
    right: PAGE.margin,
    textAlign: "center",
    fontSize: SIZE.footer,
    color: COLORS.muted,
    borderTopWidth: 1,
    borderTopColor: COLORS.rule,
    paddingTop: 6,
  },
});

/** Column width helper: W(42) → { width: "42%" }. */
export const W = (p) => ({ width: `${p}%` });
export const right = { textAlign: "right" };

/**
 * Top of every document.
 *   name   shop / supplier name
 *   lines  [string | { text, bold }]  address, phone, GSTIN …
 *   title  INVOICE / TAX INVOICE / STATEMENT …
 *   meta   [string]  lines under the title (Ref #, Date, Invoice No …)
 */
export const PdfHeader = ({ name, lines = [], title, meta = [] }) => (
  <View style={S.headerRow}>
    <View style={S.businessBlock}>
      <Text style={S.businessName}>{name}</Text>
      {lines.filter(Boolean).map((l, i) =>
        typeof l === "string" ? (
          <Text key={i} style={S.businessLine}>
            {l}
          </Text>
        ) : (
          <Text key={i} style={l.bold ? S.businessLineBold : S.businessLine}>
            {l.text}
          </Text>
        ),
      )}
    </View>
    <View style={S.docBlock}>
      <Text style={S.docTitle}>{String(title).toUpperCase()}</Text>
      {meta.filter(Boolean).map((m, i) => (
        <Text key={i} style={S.docMetaLine}>
          {m}
        </Text>
      ))}
    </View>
  </View>
);

/** Fixed footer: "<prefix> • Generated with Vyaapaar • Page 1 of 2". */
export const PdfFooter = ({ prefix = "" }) => (
  <Text style={S.footer} render={(p) => footerText(p, prefix)} fixed />
);
