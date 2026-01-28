/**
 * Utility functions for price list statistics
 */

/**
 * Count total items and categories in the price list data structure
 * @param {Object} data - The price list data object
 * @returns {Object} Object containing itemCount and categoryCount
 */
export const countItemsAndCategories = (data) => {
  let itemCount = 0;
  let categoryCount = 0;

  const traverse = (obj) => {
    if (!obj || typeof obj !== "object") return;

    Object.values(obj).forEach((node) => {
      if (node && typeof node === "object") {
        if (node.type === "item") {
          itemCount++;
        } else if (node.type === "category") {
          categoryCount++;
          if (node.children) {
            traverse(node.children);
          }
        }
      }
    });
  };

  traverse(data);
  return { itemCount, categoryCount };
};

/**
 * Get detailed statistics about the price list
 * @param {Object} data - The price list data object
 * @returns {Object} Detailed statistics
 */
export const getPriceListStats = (data) => {
  let itemCount = 0;
  let categoryCount = 0;
  let totalSellValue = 0;
  let totalCostValue = 0;
  const unitUsage = {};

  const traverse = (obj) => {
    if (!obj || typeof obj !== "object") return;

    Object.values(obj).forEach((node) => {
      if (node && typeof node === "object") {
        if (node.type === "item") {
          itemCount++;
          
          // Track unit usage
          if (node.sellUnit) {
            unitUsage[node.sellUnit] = (unitUsage[node.sellUnit] || 0) + 1;
          }
          
          // Sum values (optional - might not be meaningful without quantities)
          if (typeof node.sell === "number") {
            totalSellValue += node.sell;
          }
          if (typeof node.cost === "number") {
            totalCostValue += node.cost;
          }
        } else if (node.type === "category") {
          categoryCount++;
          if (node.children) {
            traverse(node.children);
          }
        }
      }
    });
  };

  traverse(data);

  // Calculate average profit margin
  const avgProfitMargin = totalCostValue > 0 
    ? ((totalSellValue - totalCostValue) / totalCostValue) * 100 
    : 0;

  return {
    itemCount,
    categoryCount,
    totalSellValue,
    totalCostValue,
    avgProfitMargin: avgProfitMargin.toFixed(2),
    unitUsage,
    mostUsedUnit: Object.entries(unitUsage).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
  };
};

/**
 * Count items in a specific category path
 * @param {Object} data - The price list data object
 * @param {string} path - Path to the category (e.g., "Taps.Novex / MK")
 * @returns {number} Number of items in that category and its children
 */
export const countItemsInCategory = (data, path) => {
  if (!path) return countItemsAndCategories(data).itemCount;

  const segments = path.split(".");
  let current = data;

  // Navigate to the category
  for (const segment of segments) {
    if (!current) return 0;
    
    if (current[segment]) {
      current = current[segment];
    } else if (current.children && current.children[segment]) {
      current = current.children[segment];
    } else {
      return 0;
    }
  }

  // Count items in this category
  if (!current || current.type !== "category") return 0;
  
  const { itemCount } = countItemsAndCategories(current.children || {});
  return itemCount;
};

/**
 * Get category depth (maximum nesting level)
 * @param {Object} data - The price list data object
 * @returns {number} Maximum depth of categories
 */
export const getCategoryDepth = (data) => {
  let maxDepth = 0;

  const traverse = (obj, depth = 0) => {
    if (!obj || typeof obj !== "object") return;

    Object.values(obj).forEach((node) => {
      if (node && typeof node === "object" && node.type === "category") {
        maxDepth = Math.max(maxDepth, depth + 1);
        if (node.children) {
          traverse(node.children, depth + 1);
        }
      }
    });
  };

  traverse(data);
  return maxDepth;
};

/**
 * Get all unique units used in the price list
 * @param {Object} data - The price list data object
 * @returns {Array} Array of unique units
 */
export const getUsedUnits = (data) => {
  const units = new Set();

  const traverse = (obj) => {
    if (!obj || typeof obj !== "object") return;

    Object.values(obj).forEach((node) => {
      if (node && typeof node === "object") {
        if (node.type === "item") {
          if (node.sellUnit) units.add(node.sellUnit);
          if (node.costUnit) units.add(node.costUnit);
        } else if (node.type === "category" && node.children) {
          traverse(node.children);
        }
      }
    });
  };

  traverse(data);
  return Array.from(units);
};

/**
 * Find items with specific criteria
 * @param {Object} data - The price list data object
 * @param {Function} predicate - Function to test each item
 * @returns {Array} Array of matching items with their paths
 */
export const findItems = (data, predicate) => {
  const results = [];

  const traverse = (obj, path = []) => {
    if (!obj || typeof obj !== "object") return;

    Object.entries(obj).forEach(([key, node]) => {
      if (node && typeof node === "object") {
        const currentPath = [...path, key];
        
        if (node.type === "item" && predicate(node)) {
          results.push({
            path: currentPath.join("."),
            name: key,
            item: node,
          });
        } else if (node.type === "category" && node.children) {
          traverse(node.children, currentPath);
        }
      }
    });
  };

  traverse(data);
  return results;
};

/**
 * Get items with highest/lowest prices
 * @param {Object} data - The price list data object
 * @param {number} limit - Number of items to return
 * @param {string} type - 'highest' or 'lowest'
 * @returns {Array} Array of items sorted by price
 */
export const getItemsByPrice = (data, limit = 10, type = "highest") => {
  const allItems = findItems(data, () => true);
  
  const sorted = allItems.sort((a, b) => {
    const priceA = a.item.sell || 0;
    const priceB = b.item.sell || 0;
    return type === "highest" ? priceB - priceA : priceA - priceB;
  });

  return sorted.slice(0, limit);
};