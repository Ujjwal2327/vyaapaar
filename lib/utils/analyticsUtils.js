/**
 * lib/utils/analyticsUtils.js
 *
 * Pure, framework-free calculations for the /analytics reports page. Kept
 * separate from hooks/useAnalytics.js the same way the rest of this app
 * splits data-shaping logic (lib/utils/*) from data-fetching/React state
 * (hooks/*) — see lib/utils/priceListUtils.js, lib/utils/stockUtils.js.
 *
 * A few deliberate choices worth knowing about before trusting these
 * numbers for a real business decision:
 *
 * 1. "Top-selling items" only looks at sales (type "out"). Purchases don't
 *    really have a "top-selling" concept.
 *
 * 2. Profit margin compares the ACTUAL price a line item sold for
 *    (item.price on the transaction — whatever was really charged, retail,
 *    bulk, or a one-off discount) against what the item COST when it was
 *    sold. Each sale line records that cost on itself when the sale is
 *    saved (see lib/utils/costSnapshot.js), so changing an item's cost
 *    price later doesn't rewrite the profit of sales already made. Lines
 *    with no recorded cost — sales saved before that existed, or of an
 *    item that had no cost price at the time — fall back to the item's
 *    CURRENT cost in the catalog, the same limitation the catalog's own
 *    cost/profit view has (see PriceItem.jsx / ItemDetailModal.jsx), and
 *    the periods they land in are flagged `estimated` so the chart can
 *    say so. Items with no usable cost (cost <= 0, or nothing in the
 *    catalog to fall back on) are left out of the margin calculation
 *    entirely rather than treated as 100% margin, and their revenue is
 *    reported separately as "uncosted" so it isn't silently dropped from
 *    the page.
 *
 * 3. Receivable/payable is a genuine historical trend, not the same
 *    number repeated every period: hooks/useTransactions.js's `summary`
 *    reads each transaction's *current* status/paidAmount, which only
 *    tells you where things stand today. To know where they stood at an
 *    earlier period, this replays each transaction's paidAmountHistory up
 *    to that period's end date and re-derives what would have been
 *    receivable or payable at that moment — same categorisation rules as
 *    that summary (see categorizeBalance below), just evaluated at a
 *    point in time instead of "now". The one thing that can't be rewound
 *    is totalAmount itself: if an item-kind transaction was edited later,
 *    every period uses its current total, since past totals aren't stored
 *    anywhere (only human-readable diff strings in itemListHistory).
 */

import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
  format,
} from "date-fns";
import { convertPrice } from "@/lib/utils/unitConversion";
import { getRecordedCost, getRecordedCostUnit } from "@/lib/utils/costSnapshot";

// ─── formatting ─────────────────────────────────────────────────────────────
// Same Intl.NumberFormat call already duplicated across TransactionSummary,
// TransactionCard, AddPaymentModal, NetSettleModal, etc. — centralised here
// since every file in this feature is new and needs it.
export const fmtCurrency = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n ?? 0);

// Compact Indian-style figure for axis labels (L = lakh, Cr = crore) —
// matches the ₹ + en-IN convention already used everywhere else in the
// app, just abbreviated so a Y-axis with 5-6 figure sales numbers stays
// readable on a phone screen.
export const fmtCompactCurrency = (n) => {
  const num = Math.abs(n ?? 0);
  const sign = (n ?? 0) < 0 ? "-" : "";
  if (num >= 1e7) return `${sign}₹${(num / 1e7).toFixed(1)}Cr`;
  if (num >= 1e5) return `${sign}₹${(num / 1e5).toFixed(1)}L`;
  if (num >= 1e3) return `${sign}₹${(num / 1e3).toFixed(1)}k`;
  return `${sign}₹${Math.round(num)}`;
};

// ─── period bucketing ───────────────────────────────────────────────────────

// How far back each granularity looks by default. Long enough to see a
// real trend, short enough that a daily view of a multi-year shop doesn't
// turn into an unreadable wall of bars.
const LOOKBACK = { day: 30, week: 12, month: 12 };

/**
 * Builds an ascending array of trailing period buckets ending at `now`.
 * Each bucket: { start: Date, end: Date, key: string, label: string }.
 * Weeks start on Monday, matching common business-week convention rather
 * than date-fns' Sunday default.
 */
export const buildPeriods = (granularity, now = new Date()) => {
  const count = LOOKBACK[granularity] ?? LOOKBACK.day;
  const periods = [];

  for (let i = count - 1; i >= 0; i--) {
    let start, end, key, label;

    if (granularity === "week") {
      const d = subWeeks(now, i);
      start = startOfWeek(d, { weekStartsOn: 1 });
      end = endOfWeek(d, { weekStartsOn: 1 });
      key = format(start, "yyyy-MM-dd");
      label = format(start, "d MMM");
    } else if (granularity === "month") {
      const d = subMonths(now, i);
      start = startOfMonth(d);
      end = endOfMonth(d);
      key = format(start, "yyyy-MM");
      label = format(start, "MMM yy");
    } else {
      const d = subDays(now, i);
      start = startOfDay(d);
      end = endOfDay(d);
      key = format(start, "yyyy-MM-dd");
      label = format(start, "d MMM");
    }

    periods.push({ start, end, key, label });
  }

  return periods;
};

// ─── sales vs purchases ─────────────────────────────────────────────────────

/**
 * Sums totalAmount per period, split by type ("out" = sale, "in" =
 * purchase). Both item and financial kinds count — a lump-sum financial
 * entry is just as much a sale or purchase as an itemised one.
 */
export const bucketSalesAndPurchases = (transactions, periods) => {
  const active = transactions.filter((t) => t.status !== "deleted");

  return periods.map(({ start, end, key, label }) => {
    const startMs = start.getTime();
    const endMs = end.getTime();
    let sales = 0;
    let purchases = 0;

    for (const tx of active) {
      const created = new Date(tx.createdAt).getTime();
      if (created < startMs || created > endMs) continue;
      if (tx.type === "out") sales += tx.totalAmount ?? 0;
      else purchases += tx.totalAmount ?? 0;
    }

    return { key, label, sales, purchases };
  });
};

// ─── top items ──────────────────────────────────────────────────────────────

/**
 * Aggregates itemsList across every sale (type "out", kind "item") by the
 * item's full catalog path, so two different items that happen to share a
 * leaf name (e.g. "Bib Cock" under two different brands) aren't merged
 * into one row. Returns the top `limit` by revenue and by quantity
 * separately, since the two rankings often disagree — a cheap item sold
 * in bulk vs an expensive item sold rarely.
 */
export const computeTopItems = (transactions, { limit = 8 } = {}) => {
  const totals = new Map();

  for (const tx of transactions) {
    if (tx.status === "deleted" || tx.type !== "out" || tx.kind !== "item")
      continue;

    for (const it of tx.itemsList ?? []) {
      const path = (it.name || "").trim();
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.price) || 0;
      if (!path || qty <= 0) continue;

      const parts = path.split(" › ");
      const existing = totals.get(path) ?? {
        path,
        name: parts[parts.length - 1],
        categoryPath: parts.length > 1 ? parts.slice(0, -1).join(" › ") : "",
        unit: it.unit || "",
        revenue: 0,
        quantity: 0,
      };
      existing.revenue += qty * price;
      existing.quantity += qty;
      if (it.unit) existing.unit = it.unit;
      totals.set(path, existing);
    }
  }

  const all = Array.from(totals.values());
  return {
    byRevenue: [...all].sort((a, b) => b.revenue - a.revenue).slice(0, limit),
    byQuantity: [...all]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit),
  };
};

// ─── catalog lookup for costing ─────────────────────────────────────────────

/**
 * Flattens the price-list tree into a { fullPath -> cost info } map — the
 * same shape AddTransactionModal/TransactionDetailModal already build
 * locally for their own item search (see flattenPriceItems/flattenPrice in
 * those files), but this version also keeps cost/costUnit, which those two
 * don't need for their own purposes.
 */
export const flattenCatalogForCosting = (priceData) => {
  const index = new Map();

  const walk = (node, path) => {
    Object.entries(node || {}).forEach(([key, value]) => {
      if (key.startsWith("__") || !value) return;
      const currentPath = [...path, key];

      if (value.type === "item") {
        index.set(currentPath.join(" › "), {
          cost: value.cost ?? 0,
          costUnit: value.costUnit || value.sellUnit || "piece",
          sellUnit: value.sellUnit || "piece",
        });
      } else if (value.type === "category" && value.children) {
        walk(value.children, currentPath);
      }
    });
  };

  walk(priceData, []);
  return index;
};

// ─── profit margin trend ────────────────────────────────────────────────────

/**
 * For each period, sums realised revenue and COGS for the sold lines that
 * can be costed, using, in order:
 *
 *   1. the cost recorded on the line when it was sold, else
 *   2. the item's current catalog cost — an ESTIMATE, since the cost may
 *      have changed since the sale. A period that uses any of these is
 *      flagged `estimated`, and `estimatedRevenue` is how much of its
 *      costed revenue was costed that way.
 *
 * Lines that can't be costed either way (no recorded cost and the item is
 * gone from the catalog or has no cost price, or a unit that can't be
 * converted to the cost's unit) contribute to `uncostedRevenue` instead,
 * so that revenue isn't silently missing from the total shown elsewhere
 * on the page.
 */
export const computeProfitMarginTrend = (
  transactions,
  periods,
  catalogIndex,
) => {
  const active = transactions.filter(
    (t) => t.status !== "deleted" && t.type === "out" && t.kind === "item",
  );

  return periods.map(({ start, end, key, label }) => {
    const startMs = start.getTime();
    const endMs = end.getTime();
    let revenue = 0;
    let cogs = 0;
    let uncostedRevenue = 0;
    let estimatedRevenue = 0;
    let estimated = false;

    for (const tx of active) {
      const created = new Date(tx.createdAt).getTime();
      if (created < startMs || created > endMs) continue;

      for (const it of tx.itemsList ?? []) {
        const path = (it.name || "").trim();
        const qty = parseFloat(it.quantity) || 0;
        const price = parseFloat(it.price) || 0;
        if (!path || qty <= 0) continue;

        const lineRevenue = qty * price;
        const catalogItem = catalogIndex.get(path);
        const recordedCost = getRecordedCost(it);

        let costPerUnit = null;
        let isEstimate = false;

        if (recordedCost !== null) {
          // What this item cost when the line was saved. Converted to the
          // unit the line is sold in; with no unit on the record, the cost
          // is taken to be per sale unit already.
          const costUnit = getRecordedCostUnit(it);
          costPerUnit = costUnit
            ? convertPrice(
                recordedCost,
                costUnit,
                it.unit || catalogItem?.sellUnit || costUnit,
              )
            : recordedCost;
        } else if (catalogItem && catalogItem.cost > 0) {
          // Nothing recorded on this line (it predates cost snapshots, or
          // the item had no cost price when it was sold): use today's cost
          // and flag the result as an estimate.
          costPerUnit = convertPrice(
            catalogItem.cost,
            catalogItem.costUnit,
            it.unit || catalogItem.sellUnit,
          );
          isEstimate = costPerUnit !== null;
        }

        if (costPerUnit === null) {
          // No cost on file, or one recorded in a unit that can't be
          // converted to the unit this sale used (e.g. cost per kg, sold
          // per piece) — there's no honest way to cost this line, so it's
          // excluded rather than guessed at.
          uncostedRevenue += lineRevenue;
          continue;
        }

        revenue += lineRevenue;
        cogs += costPerUnit * qty;
        if (isEstimate) {
          estimated = true;
          estimatedRevenue += lineRevenue;
        }
      }
    }

    const profit = revenue - cogs;
    return {
      key,
      label,
      revenue,
      cogs,
      profit,
      marginPct: revenue > 0 ? (profit / revenue) * 100 : null,
      uncostedRevenue,
      estimated,
      estimatedRevenue,
    };
  });
};

// ─── receivable / payable trend ─────────────────────────────────────────────

/**
 * Turns a transaction's paidAmountHistory into an ascending list of
 * { dateMs, cumulative } checkpoints, so "how much had been paid by date
 * X" is a binary search instead of re-summing the whole history for every
 * period this transaction is checked against.
 */
export const buildPaymentCheckpoints = (paidAmountHistory) => {
  const sorted = [...(paidAmountHistory ?? [])]
    .filter((p) => p?.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let running = 0;
  return sorted.map((p) => {
    running += p.amount ?? 0;
    return { dateMs: new Date(p.date).getTime(), cumulative: running };
  });
};

/** How much had been paid as of `cutoffMs` (inclusive), per the checkpoints above. */
export const paidAsOfCheckpoint = (checkpoints, cutoffMs) => {
  let result = 0;
  let lo = 0;
  let hi = checkpoints.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (checkpoints[mid].dateMs <= cutoffMs) {
      result = checkpoints[mid].cumulative;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
};

/**
 * The categorisation core of hooks/useTransactions.js's `summary` reduce,
 * pulled out as a pure function of (totalAmount, paidAmount, type) so it
 * can be evaluated at any point in time — not just "now" — by feeding it
 * a historical paidAmount from the checkpoints above. Given a status-less
 * (total, paid, type) triple, this reproduces exactly the same branches
 * that reduce uses (pending-out / overpaid-in -> receivable; pending-in /
 * overpaid-out -> payable), just derived from the sign of the remaining
 * balance instead of trusting a `status` field that has no history.
 */
export const categorizeBalance = (totalAmount, paidAmount, type) => {
  const remaining = (totalAmount ?? 0) - (paidAmount ?? 0);
  let toReceive = 0;
  let toGive = 0;

  if (type === "out") {
    if (remaining > 0) toReceive = remaining;
    else if (remaining < 0) toGive = Math.abs(remaining);
  } else {
    if (remaining > 0) toGive = remaining;
    else if (remaining < 0) toReceive = Math.abs(remaining);
  }

  return { toReceive, toGive };
};

/** Current-moment global summary — same shape/logic as useTransactions.js's
 * `summary`, just run across every transaction instead of one contact's. */
export const computeCurrentSummary = (transactions) => {
  const active = transactions.filter((t) => t.status !== "deleted");
  let toReceive = 0;
  let toGive = 0;

  for (const tx of active) {
    const { toReceive: r, toGive: g } = categorizeBalance(
      tx.totalAmount,
      tx.paidAmount,
      tx.type,
    );
    toReceive += r;
    toGive += g;
  }

  return { toReceive, toGive, net: toReceive - toGive };
};

/** Historical trend version — see the file header for how "as of" is reconstructed. */
export const computeReceivablePayableTrend = (transactions, periods) => {
  const active = transactions
    .filter((t) => t.status !== "deleted")
    .map((tx) => ({
      tx,
      createdMs: new Date(tx.createdAt).getTime(),
      checkpoints: buildPaymentCheckpoints(tx.paidAmountHistory),
    }));

  return periods.map(({ start, end, key, label }) => {
    const cutoff = end.getTime();
    let toReceive = 0;
    let toGive = 0;

    for (const { tx, createdMs, checkpoints } of active) {
      if (createdMs > cutoff) continue;
      const paidAsOf = paidAsOfCheckpoint(checkpoints, cutoff);
      const { toReceive: r, toGive: g } = categorizeBalance(
        tx.totalAmount,
        paidAsOf,
        tx.type,
      );
      toReceive += r;
      toGive += g;
    }

    return { key, label, toReceive, toGive, net: toReceive - toGive };
  });
};
