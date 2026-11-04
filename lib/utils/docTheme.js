/**
 * lib/utils/docTheme.js   (NEW)
 *
 * ONE look for everything the app prints or shares as a document: the plain
 * invoice / purchase bill, the GST tax invoice, the customer statement, the
 * contacts directory, and the payment-receipt image.
 *
 * This file is pure (no React, no @react-pdf) so any of them can import it
 * without pulling the PDF library into their bundle. The react-pdf pieces
 * (fonts, shared styles, header/footer components) live in
 * lib/utils/pdfTheme.js and are built from these numbers.
 *
 * Change a number here and every document follows.
 */

import { format } from "date-fns";

// ─── colours: black on white, four greys, nothing else ──────────────────────
export const COLORS = {
  ink: "#000000", // body text, strong rules
  text: "#333333", // secondary text (addresses, labels' values)
  muted: "#666666", // small caps labels, footer
  faint: "#888888", // sub-lines under a table cell
  rule: "#000000", // heavy rules (header underline, grand-total line)
  hairline: "#e5e5e5", // row separators
  headBg: "#f0f0f0", // table header background
  boxBg: "#f9f9f9", // note boxes, cards
};

// ─── type scale (pt) ────────────────────────────────────────────────────────
export const FONT_FAMILY = "Ubuntu";
export const FONT_FALLBACK = "Helvetica";

export const SIZE = {
  bizName: 18, // shop name in the header
  docTitle: 20, // INVOICE / TAX INVOICE / STATEMENT
  party: 12, // customer / supplier name
  grand: 12, // the one number that matters on a page
  body: 10, // default text
  totals: 10,
  cell: 9.5, // table body
  head: 9, // table header
  note: 9.5,
  label: 8, // UPPERCASE small labels
  footer: 8.5,
  sub: 7.5, // grey line under a table cell
  // Same hierarchy, one notch smaller, for the GST tax invoice's wide tables
  // (9 columns have to fit on A4 width).
  denseCell: 8.5,
  denseHead: 8,
  denseSub: 7,
};

// ─── page ───────────────────────────────────────────────────────────────────
export const PAGE = {
  size: "A4",
  margin: 24, // left / right / top
  bottom: 50, // leaves room for the fixed footer
  footerBottom: 20,
};

export const WIDTH = {
  business: "58%",
  doc: "38%",
  totals: "50%", // right-hand totals block on every document
};

// ─── wording shared by every document ──────────────────────────────────────
export const BRAND_FOOTER = "Generated with Vyaapaar";
export const footerText = ({ pageNumber, totalPages }, prefix = "") =>
  `${prefix ? `${prefix} • ` : ""}${BRAND_FOOTER} • Page ${pageNumber} of ${totalPages}`;

// ─── number + date formats ──────────────────────────────────────────────────
const num2Fmt = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 1234.5 → "1,234.50" (Indian digit grouping). */
export const num2 = (n) => num2Fmt.format(Number(n) || 0);

/** 1234.5 → "₹1,234.50"; negatives → "-₹1,234.50". */
export const money = (n) => {
  const v = Number(n) || 0;
  return `${v < 0 ? "-" : ""}₹${num2Fmt.format(Math.abs(v))}`;
};

/** Quantity without trailing zeros: 2 → "2", 2.5 → "2.5". */
export const fmtQty = (n) => {
  const v = parseFloat(n);
  return Number.isNaN(v) ? "0" : String(Number(v.toFixed(4)));
};

/** The one date format on every document: "4 Nov 2026". */
export const DATE_PATTERN = "d MMM yyyy";
export const fmtDate = (isoOrDate, pattern = DATE_PATTERN) => {
  if (!isoOrDate) return "";
  try {
    return format(new Date(isoOrDate), pattern);
  } catch {
    return "";
  }
};

/** The item name is stored as a " › "-joined catalog path; split it. */
export const splitItemName = (name) => {
  const parts = String(name ?? "").split(" › ");
  return {
    leaf: parts[parts.length - 1] || "Item",
    path: parts.length > 1 ? parts.slice(0, -1).join(" › ") : "",
  };
};

/** Short reference shown on bills that have no invoice number. */
export const shortRef = (id) =>
  id ? String(id).slice(0, 8).toUpperCase() : "—";
