export const toTitleCase = (str) => {
  if (!str || !str.trim()) return "";
  return str
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const exportToText = (priceData) => {
  let text = "";

  /**
   * Traverses the price data structure recursively.
   * @param {Object} obj - The current level of children/items being processed.
   * @param {number} indent - The current indentation level (number of spaces to use).
   * @param {Object|null} parentNode - The direct parent category node (used to fetch __orderKeys).
   */
  const traverse = (obj, indent = 0, parentNode = null) => {
    // Determine the order:
    // 1. If inside a category.children, the parentNode holds the __orderKeys.
    // 2. If obj itself contains __orderKeys (e.g., at the root level).
    // 3. Fallback to Object.keys(obj) if no order is specified (relying on insertion order).
    const orderKeys =
      (parentNode && parentNode.__orderKeys) ||
      obj.__orderKeys ||
      Object.keys(obj);

    // Iterate over the keys in the determined order
    orderKeys.forEach((key) => {
      // Skip metadata keys or non-existent keys (if orderKeys has stale entries)
      if (key.startsWith("__") || !obj[key]) return;

      const value = obj[key];
      if (!value) return;

      if (value.type === "category") {
        text += "  ".repeat(indent) + key + "\n";
        if (value.children) {
          // Pass the current category node (value) as the new parent for the recursive call
          traverse(value.children, indent + 1, value);
        }
      } else if (value.type === "item") {
        // Format: name | retailSell/bulkSell | cost | sellUnit | costUnit
        const retailSell = value.retailSell || value.sell || 0;
        const bulkSell = value.bulkSell || retailSell;
        const priceDisplay = bulkSell !== retailSell ? `${retailSell}/${bulkSell}` : `${retailSell}`;
        
        text +=
          "  ".repeat(indent) +
          `${key} | ${priceDisplay} | ${value.cost} | ${value.sellUnit} | ${value.costUnit}\n`;
      }
    });
  };

  traverse(priceData);
  return text;
};

export const importFromText = (text) => {
  if (!text || !text.trim()) {
    return {};
  }

  const lines = text.split("\n").filter((line) => line.trim());
  const root = {};
  const stack = [{ level: -1, obj: root }];

  // Helper to maintain insertion order array
  const addToContainer = (container, key, value) => {
    container[key] = value;
    // We don't need to manually push to __orderKeys here;
    // we will generate __orderKeys recursively at the end
    // based on the object insertion order which JS preserves.
  };

  lines.forEach((line) => {
    const match = line.match(/^  */);
    const level = match ? match[0].length / 2 : 0;
    const content = line.trim();

    const separator = content.includes("|") ? "|" : ",";

    if (content.includes(separator)) {
      const parts = content
        .split(separator)
        .map((p, idx) => (idx === 0 ? toTitleCase(p) : p.trim()));

      const name = parts[0];
      const priceStr = parts[1] || "0";
      const cost = parseFloat(parts[2]) || 0;
      const sellUnit = parts[3] || "piece";
      const costUnit = parts[4] || parts[3] || "piece";

      // Parse retail/bulk sell prices
      let retailSell = 0;
      let bulkSell = 0;
      
      if (priceStr.includes("/")) {
        const [retail, bulk] = priceStr.split("/").map(p => parseFloat(p.trim()) || 0);
        retailSell = retail;
        bulkSell = bulk || retail; // If bulk is 0, use retail
      } else {
        retailSell = parseFloat(priceStr) || 0;
        bulkSell = retailSell; // Same as retail if not specified
      }

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const parent = stack[stack.length - 1].obj;
      const container = parent.children || parent;

      addToContainer(container, name, {
        type: "item",
        retailSell,
        bulkSell,
        cost,
        sellUnit,
        costUnit,
      });
    } else {
      const name = toTitleCase(content);

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const parent = stack[stack.length - 1].obj;
      const container = parent.children || parent;

      const newCategory = { type: "category", children: {} };
      addToContainer(container, name, newCategory);

      stack.push({ level, obj: newCategory });
    }
  });

  // FINAL STEP: Recursively populate __orderKeys based on the insertion order
  // This ensures the root object and all subcategories have the explicit order saved.
  const generateOrderKeys = (obj) => {
    const container = obj.children || obj;
    // Get keys excluding metadata and 'type'/'children'
    const keys = Object.keys(container).filter(
      (k) => k !== "type" && k !== "children" && k !== "__orderKeys"
    );

    // Assign the order keys to the object itself
    if (keys.length > 0) {
      obj.__orderKeys = keys;
    }

    // Recurse for children categories
    keys.forEach((key) => {
      const child = container[key];
      if (child && child.type === "category") {
        generateOrderKeys(child);
      }
    });
  };

  generateOrderKeys(root);

  return root;
};

export const formatBulkText = (bulkText) => {
  if (!bulkText || !bulkText.trim()) return bulkText;

  const lines = bulkText.split("\n");
  const itemsByLevel = {};

  lines.forEach((line) => {
    if (!line.trim()) return;

    const match = line.match(/^ */);
    const leadingSpaces = match ? match[0] : "";
    const indent = leadingSpaces.length / 2;
    const content = line.trim();

    const separator = content.includes("|") ? "|" : ",";

    if (content.includes(separator)) {
      if (!itemsByLevel[indent]) {
        itemsByLevel[indent] = {
          names: [],
          prices: [],
          costs: [],
          sellUnits: [],
          costUnits: [],
        };
      }

      const parts = content
        .split(separator)
        .map((p, idx) => (idx === 0 ? toTitleCase(p) : p.trim()));

      if (parts.length >= 3) {
        itemsByLevel[indent].names.push(parts[0] || "");
        itemsByLevel[indent].prices.push(parts[1] || "");
        itemsByLevel[indent].costs.push(parts[2] || "");
        itemsByLevel[indent].sellUnits.push(parts[3] || "");
        itemsByLevel[indent].costUnits.push(parts[4] || "");
      }
    }
  });

  const maxLengths = {};
  Object.keys(itemsByLevel).forEach((level) => {
    const items = itemsByLevel[level];
    maxLengths[level] = {
      name: Math.max(...items.names.map((s) => s.length), 10) + 1,
      price: Math.max(...items.prices.map((s) => s.length), 4) + 1,
      cost: Math.max(...items.costs.map((s) => s.length), 4) + 1,
      sellUnit: Math.max(...items.sellUnits.map((s) => s.length), 5) + 1,
      costUnit: Math.max(...items.costUnits.map((s) => s.length), 5) + 1,
    };
  });

  let formatted = "";

  lines.forEach((line) => {
    if (!line.trim()) {
      formatted += "\n";
      return;
    }

    const match = line.match(/^ */);
    const leadingSpaces = match ? match[0] : "";
    const indent = leadingSpaces.length / 2;
    const content = line.trim();

    const separator = content.includes("|") ? "|" : ",";

    if (content.includes(separator)) {
      const parts = content
        .split(separator)
        .map((p, idx) => (idx === 0 ? toTitleCase(p) : p.trim()));

      if (parts.length >= 3 && maxLengths[indent]) {
        const ml = maxLengths[indent];
        const name = (parts[0] || "").padEnd(ml.name);
        const price = (parts[1] || "").padStart(ml.price);
        const cost = (parts[2] || "").padStart(ml.cost);
        const sellUnit = (parts[3] || "").padEnd(ml.sellUnit);
        const costUnit = (parts[4] || "").padEnd(ml.costUnit);
        formatted +=
          "  ".repeat(indent) +
          `${name}| ${price} | ${cost} | ${sellUnit}| ${costUnit}\n`;
      } else {
        formatted += line + "\n";
      }
    } else {
      formatted += "  ".repeat(indent) + content + "\n";
    }
  });

  return formatted;
};