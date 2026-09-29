/**
 * lib/utils/cartKeys.js
 *
 * What identifies an item in the marketplace cart, and how carts saved under
 * the two older ways of writing that get upgraded.
 *
 * A cart line's `key` is the item's catalog path in the format from
 * lib/utils/catalogPath.js. Until now the two public pages disagreed:
 *
 *   business page   Pipe.CPVC.1".Appolo Sdr 13.5          (joined with ".")
 *   marketplace     Pipe › CPVC › 1" › Appolo Sdr 13.5    (joined with " › ")
 *
 * so the same item added from both pages became two cart lines, and each page
 * showed 0 for the quantity the other one had added. Both now produce
 *
 *   Pipe.CPVC.1".Appolo Sdr 13\.5
 *
 * Old carts live in people's browsers, so nothing here can assume they are
 * gone. There are three cases:
 *
 *  - Marketplace keys (" › ") convert exactly: split on the separator, re-join
 *    with joinPath. normalizeCartKey does that, and because a current key can
 *    never contain " › " (catalogPath escapes "›"), running it over keys that
 *    were already converted is a no-op.
 *
 *  - Business-page keys for names without a "." are already identical to the
 *    current format and need nothing.
 *
 *  - Business-page keys for names WITH a "." ("...Appolo Sdr 13.5") are
 *    ambiguous on their own — that ambiguity is the bug — so they can only be
 *    resolved against the vendor's catalog. buildLegacyCartKeyMap lists, for
 *    every item whose current key differs from its old one, old -> current;
 *    remapCartLineKeys applies that to a vendor's lines. A legacy key that
 *    could mean more than one item is left alone rather than guessed at.
 *
 * Whenever two lines end up with the same key they are the same item by
 * definition, so they are merged: quantities add up (they are what the
 * customer put in the cart, and the enquiry would have listed both lines) and
 * the newer line's name/price/unit win. If the unit changed between the two,
 * adding them up would be wrong, so the newer line replaces the older one.
 */

import { joinPath, forEachCatalogItem } from "@/lib/utils/catalogPath";

/** What the marketplace search used to join path segments with. */
export const LEGACY_MARKETPLACE_SEPARATOR = " › ";

/**
 * Converts a marketplace-style key to the current format. Anything else —
 * including keys that are already current — comes back unchanged.
 */
export const normalizeCartKey = (key) =>
  typeof key === "string" && key.includes(LEGACY_MARKETPLACE_SEPARATOR)
    ? joinPath(key.split(LEGACY_MARKETPLACE_SEPARATOR))
    : key;

const toQty = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};
// Keeps 0.1 + 0.2 from showing up in the cart as 0.30000000000000004.
const roundQty = (n) => Math.round(n * 1e6) / 1e6;

/**
 * Collapses lines that share a key into one, keeping the position of the
 * first. Lines without a usable key are passed through untouched rather than
 * being merged with each other.
 */
export const mergeCartLines = (lines) => {
  const merged = [];
  const indexByKey = new Map();

  for (const line of lines) {
    if (!line || typeof line.key !== "string") {
      merged.push(line);
      continue;
    }

    const at = indexByKey.get(line.key);
    if (at === undefined) {
      indexByKey.set(line.key, merged.length);
      merged.push(line);
      continue;
    }

    const earlier = merged[at];
    const sameUnit = (earlier.unit || "") === (line.unit || "");
    merged[at] = {
      ...line,
      qty: sameUnit ? roundQty(toQty(earlier.qty) + toQty(line.qty)) : line.qty,
    };
  }

  return merged;
};

/**
 * Brings a whole saved cart up to the current key format.
 * Returns { cart, changed } — `changed` says whether anything was rewritten,
 * so the caller can decide whether writing it back to storage is worthwhile.
 * Never throws on malformed input: a vendor entry it can't make sense of is
 * carried through as-is.
 */
export const normalizeCart = (rawCart) => {
  if (!rawCart || typeof rawCart !== "object" || Array.isArray(rawCart)) {
    return { cart: {}, changed: false };
  }

  let changed = false;
  const cart = {};

  for (const [businessId, vendorCart] of Object.entries(rawCart)) {
    if (!vendorCart || !Array.isArray(vendorCart.items)) {
      cart[businessId] = vendorCart;
      continue;
    }

    let rekeyed = false;
    const rekeyedLines = vendorCart.items.map((line) => {
      const key = normalizeCartKey(line?.key);
      if (key === line?.key) return line;
      rekeyed = true;
      return { ...line, key };
    });
    const items = mergeCartLines(rekeyedLines);

    if (rekeyed || items.length !== rekeyedLines.length) {
      changed = true;
      cart[businessId] = { ...vendorCart, items };
    } else {
      cart[businessId] = vendorCart;
    }
  }

  return { cart, changed };
};

/**
 * For one vendor's catalog: Map of old business-page key -> current key, for
 * every item where the two differ (i.e. names containing ".", "\" or "›").
 *
 * An old key is left out when it is ambiguous — more than one item would have
 * had it, or it is also the real current key of some other item — because
 * remapping a line onto the wrong product is worse than leaving it alone.
 */
export const buildLegacyCartKeyMap = (tree) => {
  const currentKeys = new Set();
  const candidates = new Map(); // old key -> current key, or null once ambiguous

  forEachCatalogItem(tree, (segments) => {
    const current = joinPath(segments);
    currentKeys.add(current);

    const old = segments.join(".");
    if (old === current) return;
    candidates.set(old, candidates.has(old) ? null : current);
  });

  const map = new Map();
  candidates.forEach((current, old) => {
    if (current && !currentKeys.has(old)) map.set(old, current);
  });
  return map;
};

/**
 * Applies buildLegacyCartKeyMap's result to one vendor's lines, merging any
 * lines that end up sharing a key. Returns { items, changed }.
 */
export const remapCartLineKeys = (lines, legacyKeys) => {
  let changed = false;
  const remapped = lines.map((line) => {
    const current = legacyKeys.get(line?.key);
    if (!current) return line;
    changed = true;
    return { ...line, key: current };
  });

  return changed
    ? { items: mergeCartLines(remapped), changed }
    : { items: lines, changed };
};
