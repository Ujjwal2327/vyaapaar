/**
 * lib/utils/gstr1.js
 *
 * v2 (GST review): milligrams ("mg") no longer map to grams (they would have
 * been reported 1000x too large); they fall back to "OTH".
 *
 * Builds a GSTR-1 return for one month from the shop's GST invoices:
 *   - the JSON the GST portal / offline tool accepts (b2b, b2cl, b2cs, nil,
 *     hsn, doc_issue), and
 *   - a plain CSV invoice register a CA can open in Excel.
 *
 * Pure and dependency-free apart from gstUtils (no "@/" imports) so it can be
 * tested with plain node.
 *
 * About the format: the GSTN has not published an official JSON schema. This
 * follows what the portal's offline tool produces and accepts — since May 2025
 * Table 12 (HSN) is split into B2B and B2C (`hsn.hsn_b2b` / `hsn.hsn_b2c`)
 * with the tax rate on every row, and Table 13 (`doc_issue`) is mandatory.
 * It's meant to be uploaded and reviewed, not trusted blindly: the export
 * dialog says so and lists anything it couldn't fully represent.
 *
 * Classification (per invoice):
 *   buyer has a GSTIN                    → B2B
 *   no GSTIN, inter-state, > ₹1,00,000   → B2CL (large)
 *   everything else without a GSTIN      → B2CS (summarised by state/rate)
 *   lines taxed at 0%                    → Table 8 "nil rated" (not B2B/B2CS)
 *
 * Cancelled invoices (status "deleted") keep their number, never appear in
 * the tax tables, and are counted as cancelled in Table 13.
 */

import {
  computeGstForTx,
  gstDate,
  isIntraState,
  isValidGstin,
  istParts,
  normalizeGstin,
  round2,
} from "@/lib/utils/gstUtils";

export const B2CL_THRESHOLD = 100000; // ₹1 lakh, inter-state, unregistered buyer

// Units → the GST portal's UQC codes. Anything unmapped is "OTH".
const UQC = {
  piece: "NOS",
  pieces: "NOS",
  pc: "NOS",
  pcs: "NOS",
  pair: "PRS",
  pairs: "PRS",
  dozen: "DOZ",
  doz: "DOZ",
  gross: "GRS",
  box: "BOX",
  boxes: "BOX",
  set: "SET",
  sets: "SET",
  bag: "BAG",
  bags: "BAG",
  pack: "PAC",
  packs: "PAC",
  carton: "CTN",
  cartons: "CTN",
  bundle: "BDL",
  bundles: "BDL",
  kilogram: "KGS",
  kg: "KGS",
  kgs: "KGS",
  kilograms: "KGS",
  gram: "GMS",
  g: "GMS",
  gm: "GMS",
  grams: "GMS",
  ton: "TON",
  tons: "TON",
  tonne: "TON",
  tonnes: "TON",
  liter: "LTR",
  l: "LTR",
  ltr: "LTR",
  litre: "LTR",
  liters: "LTR",
  litres: "LTR",
  milliliter: "MLT",
  ml: "MLT",
  millilitre: "MLT",
  milliliters: "MLT",
  meter: "MTR",
  m: "MTR",
  metre: "MTR",
  meters: "MTR",
  metres: "MTR",
  kilometer: "KME",
  km: "KME",
  yard: "YDS",
  yd: "YDS",
  yards: "YDS",
  "square meter": "SQM",
  sqm: "SQM",
  "square feet": "SQF",
  "square foot": "SQF",
  sqft: "SQF",
  "square yard": "SQY",
  sqyd: "SQY",
};
export const uqcFor = (unit) =>
  UQC[
    String(unit ?? "")
      .trim()
      .toLowerCase()
  ] ?? "OTH";

const periodRange = (year, month) => {
  // Month boundaries in IST, as ISO instants (for querying created_at).
  const p = (n) => String(n).padStart(2, "0");
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  return {
    startIso: `${year}-${p(month)}-01T00:00:00+05:30`,
    endIso: `${ny}-${p(nm)}-01T00:00:00+05:30`,
  };
};
export const gstr1PeriodRange = periodRange;

/** Does this invoice's date fall in the given IST month? */
const inPeriod = (iso, year, month) => {
  const d = istParts(iso);
  return d.year === year && d.month === month;
};

const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

/**
 * @param {object} p
 * @param {object[]} p.rows   transactions (camelCase, as rowToTransaction gives)
 *   — only those with `gst` and an `invoiceNo`; each needs itemsList,
 *   additionalAmounts, gst, status, createdAt, invoiceNo, invoiceSeq, invoiceFy
 * @param {string} p.gstin    the shop's GSTIN
 * @param {number} p.year
 * @param {number} p.month    1–12
 */
export const buildGstr1 = ({ rows, gstin, year, month }) => {
  const warnings = [];
  const docs = (rows ?? [])
    .filter((r) => r.gst && r.invoiceNo && inPeriod(r.createdAt, year, month))
    .sort(
      (a, b) =>
        String(a.invoiceFy).localeCompare(String(b.invoiceFy)) ||
        a.invoiceSeq - b.invoiceSeq,
    );

  const active = docs.filter((r) => r.status !== "deleted");
  const cancelled = docs.filter((r) => r.status === "deleted");

  const b2bMap = new Map(); // ctin -> inv[]
  const b2clMap = new Map(); // pos -> inv[]
  const b2csMap = new Map(); // `${ty}|${pos}|${rate}` -> row
  const nilMap = new Map(); // sply_ty -> { nil }
  const hsnB2b = new Map();
  const hsnB2c = new Map();
  const register = [];
  let linesWithoutHsn = 0;
  let b2bLinesWithoutHsn = 0;

  const sellerState = String(gstin ?? "").slice(0, 2);

  for (const tx of active) {
    const calc = computeGstForTx(tx);
    const buyerGstin = normalizeGstin(tx.gst.buyer?.gstin);
    const registered = isValidGstin(buyerGstin);
    const pos = tx.gst.placeOfSupply || sellerState;
    const intra = isIntraState(tx.gst);
    const inum = tx.invoiceNo;
    const idt = gstDate(tx.createdAt);

    // taxed lines, one entry per rate (the portal wants rate-wise values)
    const taxedByRate = calc.byRate.filter((g) => g.rate > 0);
    const nilTaxable = round2(
      sum(
        calc.byRate.filter((g) => g.rate === 0),
        (g) => g.taxable,
      ),
    );

    let kind;
    if (registered) kind = "B2B";
    else if (!intra && calc.grandTotal > B2CL_THRESHOLD) kind = "B2CL";
    else kind = "B2CS";

    if (taxedByRate.length > 0) {
      if (kind === "B2B") {
        const inv = {
          inum,
          idt,
          val: calc.grandTotal,
          pos,
          rchrg: "N",
          inv_typ: "R",
          itms: taxedByRate.map((g, i) => ({
            num: i + 1,
            itm_det: {
              txval: g.taxable,
              rt: g.rate,
              ...(intra ? { camt: g.cgst, samt: g.sgst } : { iamt: g.igst }),
              csamt: 0,
            },
          })),
        };
        if (!b2bMap.has(buyerGstin)) b2bMap.set(buyerGstin, []);
        b2bMap.get(buyerGstin).push(inv);
      } else if (kind === "B2CL") {
        const inv = {
          inum,
          idt,
          val: calc.grandTotal,
          itms: taxedByRate.map((g, i) => ({
            num: i + 1,
            itm_det: { rt: g.rate, txval: g.taxable, iamt: g.igst, csamt: 0 },
          })),
        };
        if (!b2clMap.has(pos)) b2clMap.set(pos, []);
        b2clMap.get(pos).push(inv);
      } else {
        for (const g of taxedByRate) {
          const key = `${intra ? "INTRA" : "INTER"}|${pos}|${g.rate}`;
          const row = b2csMap.get(key) ?? {
            sply_ty: intra ? "INTRA" : "INTER",
            pos,
            typ: "OE",
            rt: g.rate,
            txval: 0,
            iamt: 0,
            camt: 0,
            samt: 0,
            csamt: 0,
          };
          row.txval += g.taxable;
          row.iamt += g.igst;
          row.camt += g.cgst;
          row.samt += g.sgst;
          b2csMap.set(key, row);
        }
      }
    }

    if (nilTaxable !== 0) {
      const ty = registered
        ? intra
          ? "INTRAB2B"
          : "INTRB2B"
        : intra
          ? "INTRAB2C"
          : "INTRB2C";
      nilMap.set(ty, round2((nilMap.get(ty) ?? 0) + nilTaxable));
    }

    // Table 12: HSN summary, B2B and B2C separately. Extra charges/discounts
    // have no HSN and aren't apportioned — see the warning below.
    for (const l of calc.lines) {
      if (l.isExtra) continue;
      if (!l.hsn) {
        linesWithoutHsn += 1;
        if (registered) b2bLinesWithoutHsn += 1;
        continue;
      }
      const uqc = uqcFor(l.unit);
      const key = `${l.hsn}|${uqc}|${l.rate}`;
      const target = registered ? hsnB2b : hsnB2c;
      const row = target.get(key) ?? {
        hsn_sc: l.hsn,
        desc: String(l.name.split(" › ").pop() ?? "").slice(0, 30),
        uqc,
        qty: 0,
        rt: l.rate,
        txval: 0,
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0,
        val: 0,
      };
      row.qty += l.quantity;
      row.txval += l.taxable;
      row.iamt += l.igst;
      row.camt += l.cgst;
      row.samt += l.sgst;
      row.val += l.total;
      target.set(key, row);
    }

    register.push({
      invoiceNo: inum,
      date: idt,
      buyer: tx.gst.buyer?.name || "",
      buyerGstin,
      placeOfSupply: pos,
      type: kind,
      taxable: calc.taxable,
      cgst: calc.cgst,
      sgst: calc.sgst,
      igst: calc.igst,
      roundOff: calc.roundOff,
      total: calc.grandTotal,
      status: "Active",
    });
  }

  for (const tx of cancelled) {
    register.push({
      invoiceNo: tx.invoiceNo,
      date: gstDate(tx.createdAt),
      buyer: tx.gst.buyer?.name || "",
      buyerGstin: normalizeGstin(tx.gst.buyer?.gstin),
      placeOfSupply: tx.gst.placeOfSupply || "",
      type: "",
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      roundOff: 0,
      total: 0,
      status: "Cancelled",
    });
  }
  register.sort((a, b) => a.invoiceNo.localeCompare(b.invoiceNo));

  const r2 = (o) =>
    Object.fromEntries(
      Object.entries(o).map(([k, v]) => [
        k,
        typeof v === "number" ? round2(v) : v,
      ]),
    );
  const numbered = (arr) => arr.map((row, i) => ({ num: i + 1, ...r2(row) }));

  // Table 13 — documents issued: one series per financial year in the month.
  const seriesMap = new Map();
  for (const d of docs) {
    const s = seriesMap.get(d.invoiceFy) ?? [];
    s.push(d);
    seriesMap.set(d.invoiceFy, s);
  }
  const docRows = [];
  for (const [fy, list] of seriesMap) {
    const seqs = list.map((d) => d.invoiceSeq);
    const lo = Math.min(...seqs);
    const hi = Math.max(...seqs);
    const cancel = list.filter((d) => d.status === "deleted").length;
    const first = list.find((d) => d.invoiceSeq === lo);
    const last = list.find((d) => d.invoiceSeq === hi);
    if (hi - lo + 1 !== list.length)
      warnings.push(
        `Invoice numbers in ${fy} aren't consecutive within this month (${lo}–${hi}, but ${list.length} issued). This happens when a bill made offline was numbered after later ones. Check Table 13 before filing.`,
      );
    docRows.push({
      num: docRows.length + 1,
      from: first.invoiceNo,
      to: last.invoiceNo,
      totnum: list.length,
      cancel,
      net_issue: list.length - cancel,
    });
  }

  if (b2bLinesWithoutHsn > 0)
    warnings.push(
      `${b2bLinesWithoutHsn} line${b2bLinesWithoutHsn !== 1 ? "s" : ""} on invoices to registered buyers ${b2bLinesWithoutHsn !== 1 ? "have" : "has"} no HSN. HSN is mandatory for B2B — fix the bill and re-export.`,
    );
  else if (linesWithoutHsn > 0)
    warnings.push(
      `${linesWithoutHsn} line${linesWithoutHsn !== 1 ? "s" : ""} ${linesWithoutHsn !== 1 ? "have" : "has"} no HSN and ${linesWithoutHsn !== 1 ? "are" : "is"} left out of the HSN summary (optional for B2C below ₹5 crore turnover).`,
    );
  if (
    active.some((tx) =>
      (tx.additionalAmounts ?? []).some((e) => e?.name?.trim()),
    )
  )
    warnings.push(
      "Extra charges and discounts (delivery etc.) are included in invoice values and tax, but have no HSN, so they are not in the HSN summary.",
    );

  const json = {
    gstin,
    fp: `${String(month).padStart(2, "0")}${year}`,
    version: "GST3.1.6",
    hash: "hash",
    ...(b2bMap.size
      ? {
          b2b: [...b2bMap].map(([ctin, inv]) => ({
            ctin,
            inv: inv.map((i) => ({
              ...i,
              val: round2(i.val),
            })),
          })),
        }
      : {}),
    ...(b2clMap.size
      ? {
          b2cl: [...b2clMap].map(([pos, inv]) => ({
            pos,
            inv: inv.map((i) => ({ ...i, val: round2(i.val) })),
          })),
        }
      : {}),
    ...(b2csMap.size ? { b2cs: [...b2csMap.values()].map(r2) } : {}),
    ...(nilMap.size
      ? {
          nil: {
            inv: [...nilMap].map(([sply_ty, nil_amt]) => ({
              sply_ty,
              expt_amt: 0,
              nil_amt,
              ngsup_amt: 0,
            })),
          },
        }
      : {}),
    hsn: {
      hsn_b2b: numbered([...hsnB2b.values()]),
      hsn_b2c: numbered([...hsnB2c.values()]),
    },
    ...(docRows.length
      ? { doc_issue: { doc_det: [{ doc_num: 1, docs: docRows }] } }
      : {}),
  };

  const totals = {
    invoices: active.length,
    cancelled: cancelled.length,
    taxable: round2(
      sum(
        register.filter((r) => r.status === "Active"),
        (r) => r.taxable,
      ),
    ),
    cgst: round2(sum(register, (r) => r.cgst)),
    sgst: round2(sum(register, (r) => r.sgst)),
    igst: round2(sum(register, (r) => r.igst)),
    value: round2(sum(register, (r) => r.total)),
    b2b: active.filter((tx) => isValidGstin(tx.gst.buyer?.gstin)).length,
  };
  totals.tax = round2(totals.cgst + totals.sgst + totals.igst);

  return { json, register, totals, warnings };
};

// ─── CSV register ────────────────────────────────────────────────────────────

const csvCell = (v) => {
  const t = String(v ?? "");
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export const registerToCsv = (register) => {
  const head = [
    "Invoice no",
    "Date",
    "Buyer",
    "Buyer GSTIN",
    "Place of supply",
    "Type",
    "Taxable value",
    "CGST",
    "SGST",
    "IGST",
    "Round off",
    "Invoice value",
    "Status",
  ];
  const lines = [head.map(csvCell).join(",")];
  for (const r of register)
    lines.push(
      [
        r.invoiceNo,
        r.date,
        r.buyer,
        r.buyerGstin,
        r.placeOfSupply,
        r.type,
        r.taxable.toFixed(2),
        r.cgst.toFixed(2),
        r.sgst.toFixed(2),
        r.igst.toFixed(2),
        r.roundOff.toFixed(2),
        r.total.toFixed(2),
        r.status,
      ]
        .map(csvCell)
        .join(","),
    );
  // BOM so Excel opens ₹/accents correctly
  return `\uFEFF${lines.join("\r\n")}\r\n`;
};
