/**
 * lib/utils/costSnapshot.js
 *
 * Cost-at-time-of-sale for sale lines — pure and framework-free, like the
 * rest of lib/utils/*.
 *
 * Why this exists: a sale's profit depends on what the goods cost when
 * they were sold, but the catalog only ever holds an item's CURRENT cost
 * price. If the profit report read costs from the catalog, changing an
 * item's cost price today would silently rewrite the profit of every sale
 * made before today. So when a sale line is saved, the item's cost is
 * copied onto the line itself:
 *
 *   { name, quantity, price, unit, cost, costUnit }
 *                                  └─────┬──────┘
 *       catalog cost per `costUnit`, as it was when the line was saved
 *
 * (transactions.items_list is a JSONB column, so the two extra keys need
 * no migration.) analyticsUtils.computeProfitMarginTrend prefers this
 * recorded cost, and falls back to the catalog's current cost — flagged
 * as an estimate — for lines that don't have one.
 *
 * Rules worth knowing:
 *
 * 1. Only sales are stamped (type "out", kind "item"). Purchases have no
 *    "cost of goods sold" to record.
 *
 * 2. Only a POSITIVE cost is recorded. In the catalog, cost 0 means "no
 *    cost price set" (that's the default for a new item, and
 *    analyticsUtils already treats cost <= 0 as uncosted), so recording it
 *    would pass off "unknown" as "free".
 *
 * 3. The cost is stored per `costUnit`, exactly as the catalog has it, and
 *    converted to the line's own unit when the report is computed. That
 *    way editing a line's unit later still costs it correctly.
 *
 * 4. Editing a sale never re-costs an item that was already on it. A line
 *    for an item the sale already had keeps the cost that item was
 *    recorded with — or stays without one, if the sale predates this:
 *    such lines are not back-filled, since that would present today's
 *    cost as a record. An item added during the edit, or a line switched
 *    to a different item, is stamped with the catalog cost at that moment.
 *
 * 5. Cost is private to the business. The invoice generator picks the
 *    line fields it prints by name (name, quantity, unit, price), so these
 *    two never reach a customer — keep it that way if a whole line is ever
 *    spread into customer-facing output.
 */

const PATH_SEPARATOR = " › ";

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const lineName = (line) =>
  typeof line?.name === "string" ? line.name.trim() : "";

const sameUnit = (a, b) =>
  (a ?? "").toString().trim().toLowerCase() ===
  (b ?? "").toString().trim().toLowerCase();

// ─── reading a line ─────────────────────────────────────────────────────────

/**
 * The cost per unit recorded on a sale line, or null if the line has none
 * (a sale from before cost snapshots, or an item with no cost price set
 * when it was sold). Never returns 0 or a negative — those mean "not set".
 */
export const getRecordedCost = (line) => {
  const raw = line?.cost;
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** The unit the recorded cost is per, or null if the line doesn't say. */
export const getRecordedCostUnit = (line) => {
  const unit = typeof line?.costUnit === "string" ? line.costUnit.trim() : "";
  return unit || null;
};

/** True if any live sale in `transactions` has a line with a recorded cost. */
export const hasAnyRecordedCost = (transactions) =>
  (transactions ?? []).some(
    (tx) =>
      tx.status !== "deleted" &&
      tx.type === "out" &&
      tx.kind === "item" &&
      (tx.itemsList ?? []).some((line) => getRecordedCost(line) !== null),
  );

// ─── building a snapshot ────────────────────────────────────────────────────

/**
 * { cost, costUnit } to record for a catalog item, or null if it has no
 * usable cost (cost missing, 0 or negative). Accepts a price-list tree
 * node or a flattenCatalogForCosting entry — both carry cost, costUnit and
 * sellUnit. The unit defaults are the same ones flattenCatalogForCosting
 * applies, so a snapshot and a live catalog lookup agree on what unit a
 * bare cost is in.
 */
export const buildCostSnapshot = (catalogItem) => {
  const cost = Number(catalogItem?.cost);
  if (!Number.isFinite(cost) || cost <= 0) return null;

  const pick = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const costUnit =
    pick(catalogItem.costUnit) || pick(catalogItem.sellUnit) || "piece";

  return { cost, costUnit };
};

/**
 * Finds an item node in a price-list tree by the same " › "-joined path a
 * sale line's `name` holds (see stockUtils.applyOneDelta, which walks the
 * tree the same way). Returns the node only if it is an item.
 */
export const findCatalogItem = (tree, path) => {
  if (!tree || typeof tree !== "object" || typeof path !== "string") {
    return null;
  }
  const segments = path.trim().split(PATH_SEPARATOR);
  let level = tree;

  for (let i = 0; i < segments.length; i++) {
    const exact = segments[i];
    const key = hasOwn(level, exact) ? exact : exact.trim();
    if (!hasOwn(level, key)) return null;

    const node = level[key];
    if (!node || typeof node !== "object") return null;

    if (i === segments.length - 1) {
      return node.type === "item" ? node : null;
    }
    if (node.type !== "category" || !node.children) return null;
    level = node.children;
  }
  return null;
};

// ─── stamping lines ─────────────────────────────────────────────────────────

/**
 * `line` carrying exactly `snapshot` ({ cost, costUnit? }) — or, for a null
 * snapshot, no cost fields at all. Returns `line` itself when it already
 * is that, so callers can tell "nothing changed" by identity.
 */
const withCostFields = (line, snapshot) => {
  const hasCost = hasOwn(line, "cost");
  const hasUnit = hasOwn(line, "costUnit");

  if (!snapshot) {
    if (!hasCost && !hasUnit) return line;
  } else if (
    hasCost &&
    line.cost === snapshot.cost &&
    (snapshot.costUnit ? line.costUnit === snapshot.costUnit : !hasUnit)
  ) {
    return line;
  }

  const next = { ...line };
  delete next.cost;
  delete next.costUnit;
  if (snapshot) {
    next.cost = snapshot.cost;
    if (snapshot.costUnit) next.costUnit = snapshot.costUnit;
  }
  return next;
};

/**
 * Returns `lines` with each line's recorded cost brought up to date:
 *
 *  - an item the sale already had (matched by name against `previousLines`,
 *    one-to-one) gets back whatever cost it was recorded with — a recorded
 *    cost stays, and a line that never had one still doesn't. Whatever
 *    cost fields the incoming line carries are not trusted over that;
 *  - an item that wasn't on the sale before is stamped from
 *    `lookupCatalogItem(name)`. If that item has no cost (or isn't in the
 *    catalog), the line ends up with no cost fields at all.
 *
 * `lookupCatalogItem(name)` returns a catalog node/entry or a falsy value.
 * `previousLines` is what is being replaced (omit it for a brand-new sale,
 * where every line is stamped). Input lines are not mutated; if nothing
 * changes, `lines` itself is returned.
 */
export const stampLinesWithCost = (
  lines,
  lookupCatalogItem,
  previousLines = [],
) => {
  if (!Array.isArray(lines)) return lines;

  // What each line being replaced was recorded with, by item name. Matching
  // uses an entry up, so two lines for the same item pair off one-to-one.
  const earlier = new Map();
  for (const prev of previousLines ?? []) {
    const name = lineName(prev);
    if (!name) continue;
    if (!earlier.has(name)) earlier.set(name, []);
    earlier.get(name).push({
      cost: getRecordedCost(prev),
      costUnit: getRecordedCostUnit(prev),
      used: false,
    });
  }

  // First, lines that still carry exactly the snapshot they were saved
  // with claim their own earlier entry, so the second step below can't
  // hand it to a different line for the same item.
  const untouched = new Set();
  lines.forEach((line, i) => {
    const cost = getRecordedCost(line);
    if (cost === null) return;
    const unit = getRecordedCostUnit(line);
    const same = (earlier.get(lineName(line)) ?? []).find(
      (p) => !p.used && p.cost === cost && sameUnit(p.costUnit, unit),
    );
    if (same) {
      same.used = true;
      untouched.add(i);
    }
  });

  let changed = false;

  const result = lines.map((line, i) => {
    if (!line || typeof line !== "object" || untouched.has(i)) return line;

    const name = lineName(line);
    const before = (earlier.get(name) ?? []).find((p) => !p.used);

    let snapshot;
    if (before) {
      before.used = true;
      snapshot =
        before.cost === null
          ? null
          : { cost: before.cost, costUnit: before.costUnit };
    } else {
      snapshot = name ? buildCostSnapshot(lookupCatalogItem(name)) : null;
    }

    const next = withCostFields(line, snapshot);
    if (next !== line) changed = true;
    return next;
  });

  return changed ? result : lines;
};

/**
 * The entry point for the save path (hooks/useTransactions.js). Stamps
 * `lines` for a sale and returns anything else untouched.
 *
 * @param {object}   args
 * @param {string}   args.type          "out" (sale) | "in" (purchase)
 * @param {string}   args.kind          "item" | "financial"
 * @param {object[]} args.lines         the transaction's itemsList
 * @param {object}   args.catalogTree   the price-list tree (price_lists.data)
 * @param {object[]} [args.previousLines] the itemsList being replaced, when editing
 */
export const stampSaleLines = ({
  type,
  kind,
  lines,
  catalogTree,
  previousLines = [],
}) => {
  if (type !== "out" || kind !== "item") return lines;
  if (!Array.isArray(lines) || lines.length === 0) return lines;

  return stampLinesWithCost(
    lines,
    (name) => findCatalogItem(catalogTree, name),
    previousLines,
  );
};
