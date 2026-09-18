/**
 * lib/utils/pivotTableUtils.js
 *
 * Turns a "category of subcategories of items" slice of the catalog tree
 * into a pivoted row/column matrix for CategoryItem's table view. Two
 * levels get pivoted — the subcategory becomes one axis, the item name
 * becomes the other, and the cell is that item's price within that
 * subcategory — regardless of how deep this slice sits in the overall
 * tree, so the same "Table" toggle works at whichever level of an
 * arbitrarily-nested catalog happens to end in exactly this shape (e.g.
 * "Vectus Tank" → 500 L / 750 L → items, or "PVC" → 2" / 3" / 4" → items).
 *
 * Deliberately narrow: a category only qualifies (see isPivotable) when
 * every child is itself a category and none of those children contain a
 * further nested category — anything shallower (plain items right under
 * this category) or deeper (three or more levels before hitting an item)
 * stays in the ordinary nested list, so this never has to guess how to
 * flatten a shape it wasn't built for.
 */

import { normalizeUnit } from "@/lib/units-config";
import { convertPrice } from "@/lib/utils/unitConversion";

const isMeta = (key) => key.startsWith("__");

/** Real (non-metadata) entries of a children map, in stored order. */
const realEntries = (children) =>
  Object.entries(children ?? {}).filter(([key]) => !isMeta(key));

/**
 * Is `node` a good candidate for the pivot table? Needs at least two
 * subcategories (a single column has nothing to pivot against), every
 * child must be a category rather than a bare item, none of those
 * subcategories may themselves contain a further category, and at least
 * one of them has to actually hold an item — otherwise every column
 * would render as a blank dash and there'd be nothing worth showing as a
 * table.
 */
export const isPivotable = (node) => {
  if (!node || node.type !== "category") return false;
  const subcats = realEntries(node.children);
  if (subcats.length < 2) return false;

  let hasAnyItem = false;
  const shapeFits = subcats.every(([, subNode]) => {
    if (!subNode || subNode.type !== "category") return false;
    const entries = realEntries(subNode.children);
    if (entries.length > 0) hasAnyItem = true;
    return entries.every(([, entry]) => entry?.type === "item");
  });

  return shapeFits && hasAnyItem;
};

/**
 * Builds the pivot matrix for a node that has already passed
 * isPivotable(). `parentPath` is the dot-joined path to `node` itself
 * (same convention as everywhere else in the catalog — see
 * PriceListContent.jsx), used to reconstruct each cell's full path for
 * onEdit/onDelete/onViewDetails.
 *
 * columns: [{ key, label }] — one per subcategory, in stored order.
 * rows:    [{ key, label }] — union of item names across every
 *          subcategory, ordered by first appearance.
 * cells:   Map<rowKey, Map<columnKey, { item, path, name }>> — only
 *          populated where that item actually exists in that column; a
 *          missing entry means "no such item here" (renders as "—").
 */
export const buildPivotData = (node, parentPath) => {
  const subcats = realEntries(node.children);
  const columns = subcats.map(([key]) => ({ key, label: key }));

  const rowOrder = [];
  const rowSeen = new Set();
  const cells = new Map();

  for (const [colKey, subNode] of subcats) {
    for (const [itemKey, item] of realEntries(subNode.children)) {
      if (!rowSeen.has(itemKey)) {
        rowSeen.add(itemKey);
        rowOrder.push(itemKey);
      }
      if (!cells.has(itemKey)) cells.set(itemKey, new Map());
      cells.get(itemKey).set(colKey, {
        item,
        name: itemKey,
        path: `${parentPath}.${colKey}.${itemKey}`,
      });
    }
  }

  const rows = rowOrder.map((key) => ({ key, label: key }));
  return { columns, rows, cells };
};

/**
 * The retail/bulk/cost/profit display math PriceItem.jsx already uses
 * for a single item in the list view, reused per-cell here so a table
 * and a list never disagree about what an item is "worth" in the
 * current priceView/sellPriceMode. Returns null when profit can't be
 * computed because the sell and cost units aren't convertible into each
 * other — same case PriceItem shows as "N/A (different units)".
 */
export const formatCellValue = (item, priceView, sellPriceMode) => {
  const sellUnit = normalizeUnit(item.sellUnit || "piece");
  const costUnit = normalizeUnit(item.costUnit || item.sellUnit || "piece");
  const retailSell =
    item.retailSell !== undefined ? item.retailSell : item.sell || 0;
  const bulkSell = item.bulkSell !== undefined ? item.bulkSell : retailSell;
  const currentSellPrice = sellPriceMode === "bulk" ? bulkSell : retailSell;

  if (priceView === "cost") {
    return { value: `₹${item.cost ?? 0}`, unit: costUnit };
  }

  if (priceView === "profit") {
    if (sellUnit.toLowerCase() === costUnit.toLowerCase()) {
      const profit = currentSellPrice - (item.cost ?? 0);
      const profitPercent =
        item.cost > 0 ? ((profit / item.cost) * 100).toFixed(1) : "0";
      return { value: `₹${profit}`, unit: `${profitPercent}%` };
    }
    const costInSellUnit = convertPrice(item.cost ?? 0, costUnit, sellUnit);
    if (costInSellUnit === null) return null;
    const profit = currentSellPrice - costInSellUnit;
    const profitPercent =
      costInSellUnit > 0 ? ((profit / costInSellUnit) * 100).toFixed(1) : "0";
    return { value: `₹${profit.toFixed(2)}`, unit: `${profitPercent}%` };
  }

  // "sell" (also the fallback for any unrecognised priceView)
  return { value: `₹${currentSellPrice}`, unit: sellUnit };
};
