/**
 * lib/utils/stockUtils.js
 *
 * Pure helpers for the opt-in, per-item stock tracking feature. Nothing in
 * here talks to Supabase or localStorage — that side-effecting part lives
 * in hooks/useTransactions.js, right next to the offline-queue plumbing it
 * has to cooperate with (see the comment above applyStockAdjustments
 * there for the full reasoning). This file only reads and transforms
 * price-list trees.
 *
 * Stock tracking is opt-in per item: an item with no `stockQty` field (the
 * default for every existing item) is simply not tracked, full stop —
 * nothing here ever invents a 0 for it or treats its absence as "out of
 * stock". `isStockTracked` is the one gate everything else goes through.
 */

export const isStockTracked = (item) => typeof item?.stockQty === "number";

/**
 * "untracked" | "ok" | "low" | "out"
 * "out" covers stockQty <= 0, including a negative (oversold) balance —
 * there's no hard blocking anywhere in this app, so stock is allowed to
 * go negative rather than clamping at zero and quietly hiding how far
 * over it went.
 */
export const getStockStatus = (item) => {
  if (!isStockTracked(item)) return "untracked";
  const threshold =
    typeof item.lowStockThreshold === "number" ? item.lowStockThreshold : 0;
  if (item.stockQty <= 0) return "out";
  if (item.stockQty <= threshold) return "low";
  return "ok";
};

/**
 * Returns null when there's no oversell concern (the item isn't tracked,
 * this is a purchase rather than a sale, or the requested quantity still
 * fits) — otherwise the resulting stock level after the sale, which is
 * always <= 0. `alreadyReserved` lets a caller account for the same item
 * appearing more than once in the same in-progress transaction before
 * this particular quantity is added — see the item search in
 * AddTransactionModal.jsx / TransactionDetailModal.jsx, which is where
 * this drives a non-blocking oversell warning while a sale is being built.
 */
export const getOversellProjection = (item, qty, type, alreadyReserved = 0) => {
  if (type !== "out" || !isStockTracked(item)) return null;
  const totalRequested = alreadyReserved + (qty || 0);
  if (totalRequested <= item.stockQty) return null;
  return item.stockQty - totalRequested;
};

/**
 * Given a stock-tracked item's current stockQty and a signed delta an
 * in-progress edit would apply (see computeStockDeltas), returns the
 * resulting stock level if it would go negative, or null if the item
 * isn't tracked or the result stays at or above zero. Used for a live
 * "would saving this take stock negative" preview while an EXISTING
 * transaction is being edited.
 *
 * Deliberately different from getOversellProjection above, which is for
 * ADDING a brand new line to a transaction that hasn't been saved yet —
 * there, only a sale can ever push stock down, since there's no
 * pre-existing contribution to reverse first. Editing an already-saved
 * transaction can drive stock negative either by increasing a sale's
 * quantity OR by decreasing a purchase's — receiving less than you
 * originally recorded can leave less on hand than what's already been
 * sold elsewhere — so this doesn't gate on transaction type at all, it
 * just asks "does applying this delta take it below zero."
 */
export const projectStockAfterDelta = (item, delta) => {
  if (!isStockTracked(item) || !delta) return null;
  const projected = item.stockQty + delta;
  return projected < 0 ? projected : null;
};

/**
 * Recursively collects every stock-tracked item that is at or below its
 * own low-stock threshold (including out-of-stock/negative items), most
 * urgent first. Used for the "Stock Alerts" summary in Settings.
 */
export const findLowStockItems = (data, path = []) => {
  const results = [];
  Object.entries(data || {}).forEach(([key, value]) => {
    if (key.startsWith("__") || !value) return;
    const currentPath = [...path, key];
    if (value.type === "item") {
      const status = getStockStatus(value);
      if (status === "low" || status === "out") {
        results.push({
          path: currentPath.join(" › "),
          name: key,
          categoryPath: currentPath.slice(0, -1).join(" › "),
          stockQty: value.stockQty,
          lowStockThreshold: value.lowStockThreshold ?? 0,
          status,
        });
      }
    } else if (value.type === "category" && value.children) {
      results.push(...findLowStockItems(value.children, currentPath));
    }
  });
  return results.sort(
    (a, b) =>
      a.stockQty - a.lowStockThreshold - (b.stockQty - b.lowStockThreshold),
  );
};

/**
 * Applies one signed delta to one item's stockQty, mutating the tree it's
 * given in place. Returns true if it actually found a stock-tracked item
 * at that path, false otherwise (path doesn't exist, resolves to a
 * category instead of an item, or the item isn't opted into tracking) —
 * all expected, silent no-ops rather than errors: a transaction line item
 * might be freeform text with no catalog link at all (see the "Blank"
 * option in AddTransactionModal's item search), might reference an item
 * that's since been renamed or deleted, or might just point at an item
 * nobody turned stock tracking on for.
 *
 * `path` is the " › "-joined full path used as a transaction line item's
 * `name` — see flattenPriceItems in AddTransactionModal.jsx / flattenPrice
 * in TransactionDetailModal.jsx, which both build it the same way.
 */
const applyOneDelta = (tree, path, delta) => {
  const segments = (path || "")
    .split(" › ")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0 || !delta) return false;

  let node = { type: "category", children: tree };
  for (const segment of segments) {
    const container = node.children;
    if (!container || !container[segment]) return false;
    node = container[segment];
  }

  if (node?.type !== "item" || !isStockTracked(node)) return false;
  node.stockQty = node.stockQty + delta;
  return true;
};

/**
 * Given a price-list tree and a list of `{ path, delta }` adjustments,
 * returns `{ tree, changed }`: a NEW, deep-cloned tree (the input is never
 * mutated) with every resolvable, stock-tracked item's stockQty adjusted,
 * plus a flag for whether anything actually changed — so a caller can
 * skip writing anything back when, say, an entire transaction was made of
 * freeform items with no catalog link.
 */
export const applyStockDeltas = (tree, itemDeltas) => {
  if (!itemDeltas || itemDeltas.length === 0) {
    return { tree, changed: false };
  }
  const cloned = JSON.parse(JSON.stringify(tree || {}));
  let changed = false;
  for (const { path, delta } of itemDeltas) {
    if (applyOneDelta(cloned, path, delta)) changed = true;
  }
  return { tree: cloned, changed };
};

/**
 * Computes the net stock delta per item path caused by creating, editing,
 * or deleting an item-kind transaction's line items. `type` is the
 * transaction's direction ("out" = sale, "in" = purchase).
 *
 * A sale removes stock as sold quantity goes up, so a line item's
 * contribution is -(newQty - oldQty). A purchase adds stock as bought
 * quantity goes up, so it's +(newQty - oldQty). An item only in the old
 * list (removed on edit, or the whole transaction being deleted)
 * contributes with newQty = 0; an item only in the new list (added on
 * edit, or the whole transaction just being created) contributes with
 * oldQty = 0 — so create (pass `[]` for oldItems) and delete (pass `[]`
 * for newItems) fall out of the exact same formula as an edit, rather
 * than needing their own separate cases. Two lines for the same item in
 * one transaction (the UI warns about this but doesn't forbid it) sum
 * correctly rather than one overwriting the other, since quantities are
 * accumulated into a Map keyed by path.
 */
export const computeStockDeltas = (oldItems, newItems, type) => {
  const sign = type === "out" ? -1 : 1;
  const netQtyByPath = new Map();

  const accumulate = (items, multiplier) => {
    for (const it of items ?? []) {
      const path = (it?.name || "").trim();
      if (!path) continue;
      const qty = parseFloat(it.quantity) || 0;
      if (!qty) continue;
      netQtyByPath.set(path, (netQtyByPath.get(path) ?? 0) + multiplier * qty);
    }
  };

  accumulate(oldItems, -1);
  accumulate(newItems, 1);

  const deltas = [];
  for (const [path, netQtyChange] of netQtyByPath.entries()) {
    if (!netQtyChange) continue;
    deltas.push({ path, delta: sign * netQtyChange });
  }
  return deltas;
};

/**
 * Bulk Edit (components/price-list/modals/BulkEditModal.jsx) rebuilds the
 * ENTIRE catalog tree from a plain-text format that only knows about
 * name/price/cost/unit/notes (see lib/utils/dataTransform.js). Left
 * alone, that means saving a bulk edit would silently strip stock
 * tracking off of every item it touches, since the freshly-parsed item
 * objects never have a stockQty field at all.
 *
 * This walks the freshly-imported tree right after importFromText() and,
 * for any item that still exists at the exact same path in the previous
 * tree, carries its stockQty/lowStockThreshold forward — the same
 * "preserve what the compact bulk format doesn't represent" approach
 * BulkEditPeopleModal.jsx already uses to keep a contact's specialty/
 * notes/photo across a bulk contacts edit. An item renamed or moved as
 * part of the bulk edit won't match (there's no stable id to fall back
 * on — same limitation as everywhere else in this catalog) and will
 * simply come back untracked, same as a brand new item would.
 */
export const preserveStockFields = (newTree, oldTree) => {
  const walk = (newNode, oldNode) => {
    if (!newNode) return;
    Object.entries(newNode).forEach(([key, value]) => {
      if (key.startsWith("__") || !value || typeof value !== "object") return;
      const oldChild = oldNode?.[key];
      if (value.type === "item") {
        if (oldChild?.type === "item" && isStockTracked(oldChild)) {
          value.stockQty = oldChild.stockQty;
          value.lowStockThreshold = oldChild.lowStockThreshold;
        }
      } else if (value.type === "category" && value.children) {
        walk(value.children, oldChild?.children);
      }
    });
  };
  walk(newTree, oldTree);
  return newTree;
};
