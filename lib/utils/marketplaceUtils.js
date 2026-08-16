// lib/utils/marketplaceUtils.js
//
// Helpers for the cross-vendor marketplace search. Deliberately does NOT
// reimplement fuzzy/fraction-aware matching — that already exists and is
// well exercised in lib/utils/priceListUtils.js (filterData +
// buildSearchIndex), which is what powers both the private catalog search
// and the existing single-shop public page search. We just run that same
// function once per vendor and merge + re-rank the results, so a search
// for '3/4 inch elbow' behaves identically whether you're searching one
// shop or all of them.

import { filterData, buildSearchIndex } from "@/lib/utils/priceListUtils";

/**
 * Flattens a price-list tree (or a filtered subset of one, as returned by
 * filterData) into a flat array of item entries. filterData annotates each
 * matched item with a _matchScore, which we carry through so cross-vendor
 * results can be ranked by relevance, not just grouped by vendor.
 */
export const flattenPriceTree = (data, path = []) => {
  const out = [];
  Object.entries(data || {}).forEach(([key, value]) => {
    if (key.startsWith("__") || !value) return;
    const currentPath = [...path, key];

    if (value.type === "item") {
      out.push({
        key: currentPath.join(" › "),
        pathParts: currentPath,
        name: key,
        categoryPath: currentPath.slice(0, -1).join(" › "),
        retailSell: value.retailSell ?? value.sell ?? 0,
        bulkSell: value.bulkSell ?? value.retailSell ?? value.sell ?? 0,
        sellUnit: value.sellUnit || "piece",
        matchScore: value._matchScore ?? 0,
      });
    } else if (value.type === "category" && value.children) {
      out.push(...flattenPriceTree(value.children, currentPath));
    }
  });
  return out;
};

/**
 * Searches every vendor's catalog for `query` and returns one flat,
 * relevance-sorted list of { ...item, vendor } across all of them.
 *
 * vendorCatalogs: [{ businessId, businessName, businessAddress,
 *                     businessPhone, priceData }]
 */
export const searchAcrossVendors = (vendorCatalogs, query) => {
  if (!query || !query.trim()) return [];

  const results = [];
  vendorCatalogs.forEach((vendor) => {
    const index = buildSearchIndex(vendor.priceData);
    const filtered = filterData(vendor.priceData, query, index);
    flattenPriceTree(filtered).forEach((item) => {
      results.push({ ...item, vendor });
    });
  });

  return results.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
};
