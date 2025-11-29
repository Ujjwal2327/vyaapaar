export const exportToText = (priceData) => {
  let text = "";

  const traverse = (obj, indent = 0) => {
    Object.entries(obj).forEach(([key, value]) => {
      if (value.type === "category") {
        text += "  ".repeat(indent) + key + "\n";
        if (value.children) {
          traverse(value.children, indent + 1);
        }
      } else if (value.type === "item") {
        text +=
          "  ".repeat(indent) +
          `${key} | ${value.sell} | ${value.sellUnit} | ${value.cost} | ${value.costUnit}\n`;
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

  lines.forEach((line) => {
    const match = line.match(/^  */);
    const level = match ? match[0].length / 2 : 0;
    const content = line.trim();

    if (content.includes("|")) {
      const parts = content.split("|").map((p) => p.trim());
      const name = parts[0];
      const sell = parseFloat(parts[1]) || 0;
      const sellUnit = parts[2] || "piece";
      const cost = parseFloat(parts[3]) || 0;
      const costUnit = parts[4] || parts[2] || "piece";

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const parent = stack[stack.length - 1].obj;
      const container = parent.children || parent;
      container[name] = { type: "item", sell, cost, sellUnit, costUnit };
    } else {
      const name = content;

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const parent = stack[stack.length - 1].obj;
      const container = parent.children || parent;
      const newCategory = { type: "category", children: {} };
      container[name] = newCategory;
      stack.push({ level, obj: newCategory });
    }
  });

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

    if (content.includes("|")) {
      if (!itemsByLevel[indent]) {
        itemsByLevel[indent] = {
          names: [],
          sells: [],
          sellUnits: [],
          costs: [],
          costUnits: [],
        };
      }

      const parts = content.split("|").map((p) => p.trim());
      if (parts.length >= 5) {
        itemsByLevel[indent].names.push(parts[0] || "");
        itemsByLevel[indent].sells.push(parts[1] || "");
        itemsByLevel[indent].sellUnits.push(parts[2] || "");
        itemsByLevel[indent].costs.push(parts[3] || "");
        itemsByLevel[indent].costUnits.push(parts[4] || "");
      }
    }
  });

  const maxLengths = {};
  Object.keys(itemsByLevel).forEach((level) => {
    const items = itemsByLevel[level];
    maxLengths[level] = {
      name: Math.max(...items.names.map((s) => s.length), 10) + 1,
      sell: Math.max(...items.sells.map((s) => s.length), 4) + 1,
      sellUnit: Math.max(...items.sellUnits.map((s) => s.length), 5) + 1,
      cost: Math.max(...items.costs.map((s) => s.length), 4) + 1,
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

    if (content.includes("|")) {
      const parts = content.split("|").map((p) => p.trim());
      if (parts.length >= 5 && maxLengths[indent]) {
        const ml = maxLengths[indent];
        const name = (parts[0] || "").padEnd(ml.name);
        const sell = (parts[1] || "").padStart(ml.sell);
        const sellUnit = (parts[2] || "").padEnd(ml.sellUnit);
        const cost = (parts[3] || "").padStart(ml.cost);
        const costUnit = (parts[4] || "").padEnd(ml.costUnit);
        formatted +=
          "  ".repeat(indent) +
          `${name}| ${sell} | ${sellUnit}| ${cost} | ${costUnit}\n`;
      } else {
        formatted += line + "\n";
      }
    } else {
      formatted += "  ".repeat(indent) + content + "\n";
    }
  });

  return formatted;
};
