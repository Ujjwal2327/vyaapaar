/**
 * lib/utils/gstUtils.js  (v2: refuses buyer/contact GSTIN == your own GSTIN)
 *
 * Pure, framework-free GST helpers (no React, no Supabase, no "@/" imports —
 * so it can be unit-tested with plain node). Everything money-related is
 * computed in integer paise and only converted back to rupees at the edge, so
 * CGST always equals SGST and line values always add up to the invoice total.
 *
 * Scope on purpose: GST applies only to ITEM-kind SALES (type "out"). Plain
 * money-in/out ("financial") entries and purchases never carry GST here — a
 * purchase's tax invoice is the supplier's document, not ours.
 *
 * A bill is a GST bill iff `tx.gst` is present. That object holds only the
 * INPUTS (price mode, place of supply, seller + buyer snapshot); every tax
 * figure is derived from them plus the lines by computeGst, so there is no
 * second copy of the numbers to drift out of sync after an edit.
 *
 *   tx.gst = {
 *     mode: "exclusive" | "inclusive",   // do line prices already contain GST?
 *     placeOfSupply: "09",               // 2-digit state code
 *     seller: { name, address, phone, gstin, stateCode },   // as at billing
 *     buyer:  { name, gstin, address },                     // gstin "" = unregistered
 *   }
 *   line  = { name, quantity, price, unit, hsn?, gstRate? }
 *   extra = { name, amount, note?, gstRate? }   // amount < 0 is a discount
 *
 * The invoice number is NOT in here: it is handed out by the database
 * (assign_invoice_number, see docs/migrations/2026-10-20-gst.sql) so the
 * series stays gapless, and arrives as tx.invoiceNo.
 */

// ─── rates ───────────────────────────────────────────────────────────────────
// Since 22 Sep 2025 most goods are 0 / 5 / 18 (40 for sin & luxury goods, 3 for
// precious metals, 0.25 for rough stones). 12 and 28 are kept only so a bill
// for goods still on an older rate, or an old item, can be recorded.
export const GST_RATE_OPTIONS = [
  { value: 0, label: "0% (nil rated)" },
  { value: 5, label: "5%" },
  { value: 18, label: "18%" },
  { value: 40, label: "40%" },
  { value: 3, label: "3%" },
  { value: 0.25, label: "0.25%" },
];
export const GST_LEGACY_RATE_OPTIONS = [
  { value: 12, label: "12% (older slab)" },
  { value: 28, label: "28% (older slab)" },
];
const ALL_RATES = new Set(
  [...GST_RATE_OPTIONS, ...GST_LEGACY_RATE_OPTIONS].map((o) => o.value),
);

export const parseRate = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};
export const isKnownRate = (v) => {
  const n = parseRate(v);
  return n !== null && ALL_RATES.has(n);
};

// ─── states ──────────────────────────────────────────────────────────────────
export const GST_STATES = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  10: "Bihar",
  11: "Sikkim",
  12: "Arunachal Pradesh",
  13: "Nagaland",
  14: "Manipur",
  15: "Mizoram",
  16: "Tripura",
  17: "Meghalaya",
  18: "Assam",
  19: "West Bengal",
  20: "Jharkhand",
  21: "Odisha",
  22: "Chhattisgarh",
  23: "Madhya Pradesh",
  24: "Gujarat",
  26: "Dadra & Nagar Haveli and Daman & Diu",
  27: "Maharashtra",
  28: "Andhra Pradesh (old)",
  29: "Karnataka",
  30: "Goa",
  31: "Lakshadweep",
  32: "Kerala",
  33: "Tamil Nadu",
  34: "Puducherry",
  35: "Andaman & Nicobar Islands",
  36: "Telangana",
  37: "Andhra Pradesh",
  38: "Ladakh",
  97: "Other Territory",
};
export const GST_STATE_OPTIONS = Object.entries(GST_STATES)
  .map(([code, name]) => ({ code: String(code).padStart(2, "0"), name }))
  .sort((a, b) => a.code.localeCompare(b.code));

export const stateName = (code) => GST_STATES[String(code ?? "")] ?? "";
export const stateLabel = (code) =>
  code ? `${stateName(code) || "State"} (${code})` : "";

// ─── GSTIN / HSN ─────────────────────────────────────────────────────────────
const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHECK_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const normalizeGstin = (v) =>
  String(v ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();

/** The 15th character of a GSTIN, from the first 14 (mod-36 checksum). */
export const gstinCheckChar = (first14) => {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHECK_CHARS.indexOf(first14[i]);
    if (v < 0) return null;
    const product = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHECK_CHARS[(36 - (sum % 36)) % 36];
};

export const isValidGstin = (v) => {
  const g = normalizeGstin(v);
  if (!GSTIN_SHAPE.test(g)) return false;
  if (!GST_STATES[g.slice(0, 2)]) return false;
  return gstinCheckChar(g.slice(0, 14)) === g[14];
};

/** Reason a GSTIN is rejected, or null if it's fine / empty. */
export const gstinProblem = (v) => {
  const g = normalizeGstin(v);
  if (!g) return null;
  if (g.length !== 15)
    return `GSTIN is 15 characters (you've typed ${g.length})`;
  if (!GSTIN_SHAPE.test(g)) return "That doesn't look like a GSTIN";
  if (!GST_STATES[g.slice(0, 2)]) return "Unknown state code at the start";
  if (gstinCheckChar(g.slice(0, 14)) !== g[14])
    return "Check the GSTIN — the last character doesn't match";
  return null;
};

export const OWN_GSTIN_MESSAGE =
  "This is your own GSTIN — a customer can't have the same GSTIN as your shop. Leave it empty if they have none.";

/** Problem with a CONTACT's GSTIN: malformed, or the same as the shop's own. */
export const contactGstinProblem = (v, ownGstin) => {
  const bad = gstinProblem(v);
  if (bad) return bad;
  const g = normalizeGstin(v);
  const own = normalizeGstin(ownGstin);
  return g && own && g === own ? OWN_GSTIN_MESSAGE : null;
};

export const gstinState = (v) => {
  const g = normalizeGstin(v);
  return g.length >= 2 && GST_STATES[g.slice(0, 2)] ? g.slice(0, 2) : "";
};

export const normalizeHsn = (v) => String(v ?? "").replace(/\D/g, "");
export const isValidHsn = (v) =>
  /^\d{4}$|^\d{6}$|^\d{8}$/.test(normalizeHsn(v));
export const hsnProblem = (v, { required = false } = {}) => {
  const h = normalizeHsn(v);
  if (!h) return required ? "HSN needed for a GST-registered buyer" : null;
  return isValidHsn(h) ? null : "HSN is 4, 6 or 8 digits";
};

// ─── money (integer paise) ───────────────────────────────────────────────────
const toPaise = (rupees) => Math.round((Number(rupees) || 0) * 100);
// Half-away-from-zero, so a discount rounds the mirror image of a charge.
const roundHalfAway = (x) => Math.sign(x) * Math.round(Math.abs(x) + 1e-9);
const rupees = (paise) => paise / 100;

export const round2 = (n) => rupees(roundHalfAway((Number(n) || 0) * 100));

// ─── the calculation ─────────────────────────────────────────────────────────

/** Tax-exclusive amount `taxable` (paise) → { cgst, sgst, igst } in paise. */
const taxOnExclusive = (taxablePaise, rate, intra) => {
  if (!rate) return { cgst: 0, sgst: 0, igst: 0 };
  if (intra) {
    const half = roundHalfAway((taxablePaise * rate) / 200);
    return { cgst: half, sgst: half, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: roundHalfAway((taxablePaise * rate) / 100) };
};

/** Tax-inclusive amount `grossPaise` → { taxable, cgst, sgst, igst } in paise. */
const splitInclusive = (grossPaise, rate, intra) => {
  if (!rate) return { taxable: grossPaise, cgst: 0, sgst: 0, igst: 0 };
  if (intra) {
    const half = roundHalfAway((grossPaise * rate) / (200 + 2 * rate));
    return { taxable: grossPaise - 2 * half, cgst: half, sgst: half, igst: 0 };
  }
  const igst = roundHalfAway((grossPaise * rate) / (100 + rate));
  return { taxable: grossPaise - igst, cgst: 0, sgst: 0, igst };
};

/** Higher rate wins as the default for extra charges (delivery etc.). */
export const highestRate = (items) =>
  (items ?? []).reduce((m, it) => {
    const r = parseRate(it?.gstRate);
    return r !== null && r > m ? r : m;
  }, 0);

/**
 * @param {object} p
 * @param {object[]} p.items   lines ({ name, quantity, price, unit, hsn, gstRate })
 * @param {object[]} [p.extras] extra charges/discounts ({ name, amount, gstRate })
 * @param {"exclusive"|"inclusive"} p.mode
 * @param {boolean} p.intra    true → CGST+SGST, false → IGST
 * @param {boolean} [p.roundOff=true] round the invoice to the nearest rupee
 *
 * Lines without a name are ignored (the same way the rest of the app treats
 * blank cart rows). A line with no valid rate is taxed at 0 and listed in
 * `missingRate` so callers can refuse to save it.
 */
export const computeGst = ({
  items,
  extras = [],
  mode = "exclusive",
  intra = true,
  roundOff = true,
}) => {
  const inclusive = mode === "inclusive";
  const fallbackExtraRate = highestRate(items);
  const lines = [];
  const missingRate = [];

  const push = (src, isExtra, index) => {
    const qty = isExtra ? null : parseFloat(src.quantity) || 0;
    const price = isExtra ? null : parseFloat(src.price) || 0;
    const base = toPaise(isExtra ? src.amount : qty * price);
    let rate = parseRate(src.gstRate);
    if (rate === null) {
      if (isExtra) rate = fallbackExtraRate;
      else {
        missingRate.push(index);
        rate = 0;
      }
    }

    let taxable, tax;
    if (inclusive) {
      const s = splitInclusive(base, rate, intra);
      taxable = s.taxable;
      tax = s;
    } else {
      taxable = base;
      tax = taxOnExclusive(base, rate, intra);
    }
    const taxTotal = tax.cgst + tax.sgst + tax.igst;

    lines.push({
      isExtra,
      name: String(src.name ?? "").trim(),
      hsn: isExtra ? "" : normalizeHsn(src.hsn),
      quantity: qty,
      unit: isExtra ? "" : src.unit || "",
      price,
      rate,
      taxable: rupees(taxable),
      cgst: rupees(tax.cgst),
      sgst: rupees(tax.sgst),
      igst: rupees(tax.igst),
      tax: rupees(taxTotal),
      total: rupees(taxable + taxTotal),
      _p: { taxable, cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst },
    });
  };

  (items ?? []).forEach((it, i) => {
    if (String(it?.name ?? "").trim()) push(it, false, i);
  });
  (extras ?? []).forEach((ex, i) => {
    if (String(ex?.name ?? "").trim()) push(ex, true, i);
  });

  const sum = (key) => lines.reduce((s, l) => s + l._p[key], 0);
  const taxableP = sum("taxable");
  const cgstP = sum("cgst");
  const sgstP = sum("sgst");
  const igstP = sum("igst");
  const subtotalP = taxableP + cgstP + sgstP + igstP;
  const grandP = roundOff ? Math.round(subtotalP / 100) * 100 : subtotalP;

  // Rate-wise and HSN-wise summaries (the PDF's tax table, GSTR-1 Table 12)
  const group = (keyFn, seed) => {
    const map = new Map();
    for (const l of lines) {
      const k = keyFn(l);
      const g = map.get(k) ?? { ...seed(l), _t: 0, _c: 0, _s: 0, _i: 0 };
      g._t += l._p.taxable;
      g._c += l._p.cgst;
      g._s += l._p.sgst;
      g._i += l._p.igst;
      map.set(k, g);
    }
    return [...map.values()].map(({ _t, _c, _s, _i, ...rest }) => ({
      ...rest,
      taxable: rupees(_t),
      cgst: rupees(_c),
      sgst: rupees(_s),
      igst: rupees(_i),
      tax: rupees(_c + _s + _i),
    }));
  };

  return {
    lines: lines.map(({ _p, ...l }) => l),
    missingRate,
    mode,
    intra,
    taxable: rupees(taxableP),
    cgst: rupees(cgstP),
    sgst: rupees(sgstP),
    igst: rupees(igstP),
    tax: rupees(cgstP + sgstP + igstP),
    subtotal: rupees(subtotalP),
    roundOff: rupees(grandP - subtotalP),
    grandTotal: rupees(grandP),
    byRate: group(
      (l) => l.rate,
      (l) => ({ rate: l.rate }),
    ).sort((a, b) => a.rate - b.rate),
    byHsn: group(
      (l) => `${l.hsn}|${l.rate}`,
      (l) => ({ hsn: l.hsn, rate: l.rate }),
    ).sort((a, b) => a.hsn.localeCompare(b.hsn) || a.rate - b.rate),
  };
};

// ─── transaction-level helpers ───────────────────────────────────────────────

export const isGstBill = (tx) => !!tx?.gst;

export const isIntraState = (gst) =>
  !gst?.seller?.stateCode ||
  !gst?.placeOfSupply ||
  gst.seller.stateCode === gst.placeOfSupply;

/** Full GST breakdown for a stored transaction (or a draft shaped like one). */
export const computeGstForTx = (tx) =>
  computeGst({
    items: tx.itemsList ?? [],
    extras: tx.additionalAmounts ?? [],
    mode: tx.gst?.mode ?? "exclusive",
    intra: isIntraState(tx.gst),
  });

/**
 * Seller/buyer/place-of-supply snapshot to store on a new GST bill.
 * `placeOfSupply` null → follow the buyer's GSTIN state, else the seller's.
 */
export const buildGstSnapshot = ({
  business,
  buyerName = "",
  buyerAddress = "",
  buyerGstin = "",
  placeOfSupply = null,
  mode = "exclusive",
}) => {
  const sellerGstin = normalizeGstin(business?.gstin);
  const sellerState = gstinState(sellerGstin);
  const bGstin = normalizeGstin(buyerGstin);
  return {
    mode,
    placeOfSupply: placeOfSupply || gstinState(bGstin) || sellerState || "",
    seller: {
      name: business?.businessName || "",
      address: business?.businessAddress || "",
      phone: business?.phone || "",
      gstin: sellerGstin,
      stateCode: sellerState,
    },
    buyer: {
      name: buyerName || "",
      gstin: bGstin,
      address: buyerAddress || "",
    },
  };
};

/** Place of supply to pre-select: buyer GSTIN's state, else the seller's. */
export const autoPlaceOfSupply = (sellerGstin, buyerGstin) =>
  (isValidGstin(buyerGstin) ? gstinState(buyerGstin) : "") ||
  gstinState(sellerGstin) ||
  "";

/**
 * Everything the bill form derives from its three GST inputs, in one place so
 * the form, the totals and the saved snapshot can never disagree.
 *   draft: { buyerGstin: string|null, pos: string|null }
 *     null buyerGstin → use the contact's saved GSTIN; null pos → automatic.
 */
export const resolveBillGst = ({ draft, sellerGstin, contactGstin }) => {
  const buyerGstin = normalizeGstin(draft?.buyerGstin ?? contactGstin ?? "");
  const buyerValid = isValidGstin(buyerGstin);
  const sellerState = gstinState(sellerGstin);
  const pos =
    draft?.pos || autoPlaceOfSupply(sellerGstin, buyerValid ? buyerGstin : "");
  return {
    buyerGstin,
    buyerValid,
    // Billing yourself is not a supply: same GSTIN on both sides is refused.
    buyerProblem:
      gstinProblem(buyerGstin) ||
      (buyerValid && buyerGstin === normalizeGstin(sellerGstin)
        ? "This is your own GSTIN — you can't raise a GST invoice to yourself. Use the customer's GSTIN, or leave it empty for a customer without one."
        : null),
    pos,
    intra: !sellerState || !pos || sellerState === pos,
  };
};

/**
 * Problems that must stop a GST bill being saved. Returns [] when it's good.
 * `requireHsn` is true for B2B (buyer has a GSTIN): HSN is mandatory there.
 */
export const validateGstLines = (items, { requireHsn = false } = {}) => {
  const problems = [];
  (items ?? []).forEach((it) => {
    const name = String(it?.name ?? "").trim();
    if (!name) return;
    const label = name.split(" › ").pop();
    if (parseRate(it.gstRate) === null)
      problems.push(`${label}: choose a GST rate`);
    const h = hsnProblem(it.hsn, { required: requireHsn });
    if (h) problems.push(`${label}: ${h}`);
  });
  return problems;
};

/** Net-of-GST revenue for one sale line — what reports should count. */
export const lineNetRevenue = (tx, line) => {
  const gross =
    (parseFloat(line?.quantity) || 0) * (parseFloat(line?.price) || 0);
  const rate = parseRate(line?.gstRate);
  if (tx?.gst?.mode === "inclusive" && rate) return gross / (1 + rate / 100);
  return gross;
};

// ─── catalog helpers ─────────────────────────────────────────────────────────

/**
 * Returns a deep copy of a price-list tree with hsn / gstRate set on the item
 * at `path` (the " › "-joined catalog path a bill line's `name` holds).
 * Unchanged tree comes back as-is when the path doesn't resolve to an item.
 */
export const withItemTaxInfo = (tree, path, { hsn, gstRate }) => {
  const segments = String(path ?? "")
    .split(" › ")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return tree;
  const cloned = JSON.parse(JSON.stringify(tree || {}));
  let node = { type: "category", children: cloned };
  for (const seg of segments) {
    if (!node.children || !node.children[seg]) return tree;
    node = node.children[seg];
  }
  if (node?.type !== "item") return tree;
  const h = normalizeHsn(hsn);
  const r = parseRate(gstRate);
  if (h) node.hsn = h;
  if (r !== null) node.gstRate = r;
  return cloned;
};

/**
 * Bulk Edit rebuilds the whole catalog from a text format that has no HSN or
 * GST columns, so without this every item it touches would silently lose
 * them — same reason (and same shape) as stockUtils.preserveStockFields.
 */
export const preserveGstFields = (newTree, oldTree) => {
  const walk = (newNode, oldNode) => {
    if (!newNode) return;
    Object.entries(newNode).forEach(([key, value]) => {
      if (key.startsWith("__") || !value || typeof value !== "object") return;
      const oldChild = oldNode?.[key];
      if (value.type === "item") {
        if (oldChild?.type === "item") {
          if (oldChild.hsn) value.hsn = oldChild.hsn;
          if (typeof oldChild.gstRate === "number")
            value.gstRate = oldChild.gstRate;
        }
      } else if (value.type === "category" && value.children) {
        walk(value.children, oldChild?.children);
      }
    });
  };
  walk(newTree, oldTree);
  return newTree;
};

// ─── IST dates & financial year ──────────────────────────────────────────────
const istFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** { year, month (1-12), day } of an instant as seen in India. */
export const istParts = (isoOrDate) => {
  const parts = Object.fromEntries(
    istFormatter
      .formatToParts(new Date(isoOrDate))
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  );
  return { year: parts.year, month: parts.month, day: parts.day };
};

/** "26-27" for any date from 1 Apr 2026 to 31 Mar 2027 (IST). */
export const financialYearOf = (isoOrDate) => {
  const { year, month } = istParts(isoOrDate);
  const start = month >= 4 ? year : year - 1;
  const yy = (n) => String(n % 100).padStart(2, "0");
  return `${yy(start)}-${yy(start + 1)}`;
};

/** DD-MM-YYYY, the date format GSTR-1 JSON wants. */
export const gstDate = (isoOrDate) => {
  const { year, month, day } = istParts(isoOrDate);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(day)}-${p(month)}-${year}`;
};

// ─── amount in words (Indian numbering) ──────────────────────────────────────
const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

const below100 = (n) =>
  n < 20
    ? ONES[n]
    : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
const below1000 = (n) =>
  n >= 100
    ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${below100(n % 100)}` : ""}`
    : below100(n);

const wholeInWords = (n) => {
  if (n === 0) return "Zero";
  const parts = [];
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const rest = n % 1e3;
  if (crore) parts.push(`${wholeInWords(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
};

/** 1234.5 → "Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only" */
export const amountInWords = (amount) => {
  const paiseTotal = Math.round(Math.abs(Number(amount) || 0) * 100);
  const rs = Math.floor(paiseTotal / 100);
  const ps = paiseTotal % 100;
  return `Rupees ${wholeInWords(rs)}${ps ? ` and ${below100(ps)} Paise` : ""} Only`;
};

// ─── invoice number display ──────────────────────────────────────────────────
/** "INV/26-27/00001" → "INV-26-27-00001" (safe in a filename). */
export const invoiceFileStem = (invoiceNo) =>
  String(invoiceNo ?? "").replace(/[^A-Za-z0-9]+/g, "-");
