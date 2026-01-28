export const getItemAtPath = (data, path) => {
  if (!path) return data;
  const parts = path.split(".");
  let current = data;
  for (const part of parts) {
    if (!current) return null;
    if (current.children && current.children[part]) {
      current = current.children[part];
    } else if (current[part]) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
};

/* ---------------------------
   Tokenization & Normalization
   --------------------------- */

const unitToken = (word) => {
  if (!word) return null;
  const u = word.toLowerCase();
  if (/^("|inch|in|inches|inchs)$/i.test(u)) return "inch";
  if (/^(mm|millimeter|millimetre|millimeters|millimetres)$/i.test(u))
    return "mm";
  if (/^(cm|centimeter|centimetre|centimeters|centimetres)$/i.test(u))
    return "cm";
  if (/^(m|meter|metre|meters|metres)$/i.test(u)) return "m";
  if (/^(kg|kilogram|kgs|kilograms)$/i.test(u)) return "kg";
  if (/^(g|gram|grams|gm|gms)$/i.test(u)) return "g";
  if (/^(ltr|l|liter|litre|liters|litres)$/i.test(u)) return "l";
  if (/^(ft|foot|feet|')$/i.test(u)) return "foot";
  if (/^(oz|ounce|ounces)$/i.test(u)) return "oz";
  if (/^(pcs|pc|piece|pieces)$/i.test(u)) return "piece";
  if (/^(box|boxes|bx)$/i.test(u)) return "box";
  if (/^(pack|packs|pk)$/i.test(u)) return "pack";
  if (/^(set|sets)$/i.test(u)) return "set";
  if (/^(pair|pairs|pr)$/i.test(u)) return "pair";
  if (/^(dozen|doz)$/i.test(u)) return "dozen";
  if (/^(bottle|bottles|btl)$/i.test(u)) return "bottle";
  if (/^(can|cans)$/i.test(u)) return "can";
  if (/^(roll|rolls)$/i.test(u)) return "roll";
  if (/^(sheet|sheets)$/i.test(u)) return "sheet";
  return null;
};

// Check if token is a fraction (1/2) or reducer notation (1/2-3/4)
const isFraction = (t) => /^\d+\/\d+$/.test(t);
const isReducer = (t) => /^\d+\/\d+-\d+\/\d+$/.test(t); // e.g., 1/2-3/4
const isNumeric = (t) => /^\d+$/.test(t);
const isDecimal = (t) => /^\d+\.\d+$/.test(t);

// Convert fraction to decimal
const fractionToDecimal = (fraction) => {
  const parts = fraction.split('/');
  if (parts.length !== 2) return null;
  const numerator = parseFloat(parts[0]);
  const denominator = parseFloat(parts[1]);
  if (denominator === 0) return null;
  return numerator / denominator;
};

// Convert decimal to common fractions (up to denominator 16)
const decimalToFractions = (decimal) => {
  const fractions = [];
  const num = parseFloat(decimal);
  
  // Check common denominators (2, 4, 8, 16, 3, 5, 6, 10, 12)
  const denominators = [2, 3, 4, 5, 6, 8, 10, 12, 16];
  
  for (const denom of denominators) {
    const numerator = Math.round(num * denom);
    const calculatedDecimal = numerator / denom;
    
    // If within 0.01 tolerance, it's a match
    if (Math.abs(calculatedDecimal - num) < 0.01) {
      // Simplify fraction
      const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
      const divisor = gcd(numerator, denom);
      fractions.push(`${numerator / divisor}/${denom / divisor}`);
    }
  }
  
  return fractions;
};

// Levenshtein distance for fuzzy matching
const levenshtein = (a, b) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

/**
 * tokenize(text)
 * returns normalized tokens array
 * - Handles fractions and reducer notations specially
 * - Handles decimals and converts to fraction equivalents
 */
const tokenize = (text) => {
  if (!text) return [];

  let s = String(text).toLowerCase();

  // remove quotes/backticks
  s = s.replace(/["'`´]/g, "");

  // collect fraction/reducer placeholders to avoid splitting them
  const placeholders = [];
  let phIndex = 0;

  // match reducer notation like 1/2-3/4 or 3/4"-1/2" (with optional spaces and quotes)
  s = s.replace(/(\d+\/\d+)\s*["-]\s*(\d+\/\d+)/g, (match, frac1, frac2) => {
    const val = `${frac1}-${frac2}`; // normalize to 1/2-3/4
    const ph = `__REDUCER_${phIndex++}__`;
    placeholders.push({ ph, val, fractions: [frac1, frac2] });
    return ph;
  });

  // match simple fractions like 1/2
  s = s.replace(/(\d+)\s*\/\s*(\d+)/g, (_, a, b) => {
    const val = `${a}/${b}`;
    const ph = `__FRACTION_${phIndex++}__`;
    placeholders.push({ ph, val });
    return ph;
  });

  // match decimals like 1.25 and store their fraction equivalents
  s = s.replace(/(\d+\.\d+)/g, (match) => {
    const ph = `__DECIMAL_${phIndex++}__`;
    placeholders.push({ ph, val: match, type: 'decimal' });
    return ph;
  });

  // split on non-alphanumeric (but preserve placeholders)
  const rawParts = s.split(/[^a-z0-9_]+/i).filter(Boolean);

  const tokens = [];
  for (const p of rawParts) {
    const ph = placeholders.find((x) => x.ph === p);
    if (ph) {
      tokens.push(ph.val);
      continue;
    }

    // numeric token
    if (/^\d+$/.test(p)) {
      tokens.push(p);
      continue;
    }

    // unit synonyms
    const ut = unitToken(p);
    if (ut) {
      tokens.push(ut);
      continue;
    }

    // otherwise alpha/alnum token
    const cleaned = p.replace(/[^\w]/g, "");
    if (cleaned) tokens.push(cleaned);
  }

  return tokens.filter(Boolean);
};

/* Token match rules with scoring */
const matchTokenAgainst = (searchToken, pathToken, allowFuzzy = true) => {
  if (!searchToken || !pathToken) return 0;

  // EXACT MATCH - highest priority
  if (pathToken === searchToken) return 100;

  // DECIMAL ↔ FRACTION MATCHING
  // Check if one is decimal and other is fraction (or vice versa)
  const searchIsDecimal = isDecimal(searchToken);
  const pathIsDecimal = isDecimal(pathToken);
  const searchIsFraction = isFraction(searchToken);
  const pathIsFraction = isFraction(pathToken);

  if (searchIsDecimal && pathIsFraction) {
    const searchDecimalVal = parseFloat(searchToken);
    const pathDecimalVal = fractionToDecimal(pathToken);
    if (pathDecimalVal !== null && Math.abs(searchDecimalVal - pathDecimalVal) < 0.01) {
      return 100; // Treat as exact match
    }
  }

  if (searchIsFraction && pathIsDecimal) {
    const searchDecimalVal = fractionToDecimal(searchToken);
    const pathDecimalVal = parseFloat(pathToken);
    if (searchDecimalVal !== null && Math.abs(searchDecimalVal - pathDecimalVal) < 0.01) {
      return 100; // Treat as exact match
    }
  }

  // Also check if decimal matches any fraction representation in path
  if (searchIsDecimal) {
    const possibleFractions = decimalToFractions(searchToken);
    if (possibleFractions.some(frac => pathToken.includes(frac))) {
      return 100;
    }
  }

  if (pathIsDecimal) {
    const possibleFractions = decimalToFractions(pathToken);
    if (possibleFractions.some(frac => searchToken.includes(frac))) {
      return 100;
    }
  }

  // REDUCER NOTATION HANDLING
  if (isReducer(searchToken)) {
    const [f1, f2] = searchToken.split("-");
    if (
      (pathToken.includes(f1) && pathToken.includes(f2)) ||
      pathToken === `${f2}-${f1}`
    ) {
      return 80;
    }
  }

  if (isReducer(pathToken)) {
    if (isFraction(searchToken)) {
      return pathToken === searchToken ||
        pathToken.split("-").includes(searchToken)
        ? 70
        : 0;
    }
    return 0;
  }

  // FRACTION MATCHING
  if (isFraction(searchToken)) {
    if (pathToken.includes(searchToken)) return 70;
    return 0;
  }

  // NUMERIC MATCHING
  if (isNumeric(searchToken)) {
    return 0;
  }

  // If fuzzy matching is disabled, stop here
  if (!allowFuzzy) return 0;

  // ALPHA/ALNUM TOKEN MATCHING (Only if fuzzy is allowed)
  if (pathToken.startsWith(searchToken)) return 5;

  const wordBoundaryRegex = new RegExp(`\\b${searchToken}\\b`, "i");
  if (wordBoundaryRegex.test(pathToken)) return 6;

  if (searchToken.length >= 4 && pathToken.includes(searchToken)) return 3;

  if (searchToken.length >= 4) {
    const distance = levenshtein(searchToken, pathToken);
    const maxDistance = Math.min(2, Math.floor(searchToken.length / 3));
    if (distance <= maxDistance) {
      return 2;
    }
  }

  return 0;
};

/* Flatten data into list of entries with token arrays */
const flattenData = (data) => {
  const entries = [];

  const rec = (obj, trail = []) => {
    Object.entries(obj).forEach(([key, value]) => {
      const newTrail = [...trail, key];
      const pathTokens = newTrail.flatMap((segment) => tokenize(segment));
      entries.push({
        keyPath: newTrail,
        pathTokens,
        node: value,
        rawKey: key,
      });

      if (value && value.type === "category" && value.children) {
        rec(value.children, newTrail);
      }
    });
  };

  rec(data, []);
  return entries;
};

/* Build result tree from matched entries with scores */
const buildResultTreeFromMatches = (matches) => {
  const root = {};

  for (const m of matches) {
    let cursor = root;
    const path = m.keyPath;
    for (let i = 0; i < path.length; i++) {
      const key = path[i];
      const isLast = i === path.length - 1;
      if (!cursor[key]) {
        if (isLast) {
          if (m.node && m.node.type === "category") {
            cursor[key] = {
              ...m.node,
              children: m.node.children ? { ...m.node.children } : {},
              _matchScore: m.score,
            };
          } else {
            cursor[key] = { ...m.node, _matchScore: m.score };
          }
        } else {
          cursor[key] = { type: "category", children: {} };
        }
      }
      if (!isLast) {
        cursor = cursor[key].children = cursor[key].children || {};
      }
    }
  }

  return root;
};

/* Main filterData: scored AND-match across path tokens with exact match priority */
export const filterData = (data, search) => {
  if (!search) return data;

  const searchTokens = tokenize(search);
  if (searchTokens.length === 0) return {};

  const entries = flattenData(data);

  // FIRST PASS: Check for exact matches
  const exactMatches = [];
  let hasExactMatch = false;

  for (const entry of entries) {
    let isExactMatch = true;
    let totalScore = 0;

    for (const st of searchTokens) {
      let bestScore = 0;
      let foundExact = false;

      for (const pt of entry.pathTokens) {
        const score = matchTokenAgainst(st, pt, false); // Disable fuzzy for first pass
        if (score === 100) {
          foundExact = true;
          bestScore = 100;
          break;
        }
      }

      if (!foundExact) {
        isExactMatch = false;
        break;
      }
      totalScore += bestScore;
    }

    if (isExactMatch) {
      hasExactMatch = true;
      exactMatches.push({ ...entry, score: totalScore });
    }
  }

  // If we found exact matches, return only those
  if (hasExactMatch) {
    exactMatches.sort((a, b) => b.score - a.score);
    return buildResultTreeFromMatches(exactMatches);
  }

  // SECOND PASS: No exact matches found, use fuzzy matching
  const matchedEntries = [];

  for (const entry of entries) {
    let totalScore = 0;
    let allMatched = true;

    for (const st of searchTokens) {
      let bestScore = 0;
      for (const pt of entry.pathTokens) {
        const score = matchTokenAgainst(st, pt, true); // Enable fuzzy
        if (score > bestScore) bestScore = score;
      }
      if (bestScore === 0) {
        allMatched = false;
        break;
      }
      totalScore += bestScore;
    }

    if (allMatched) {
      matchedEntries.push({ ...entry, score: totalScore });
    }
  }

  if (matchedEntries.length === 0) return {};

  matchedEntries.sort((a, b) => b.score - a.score);
  return buildResultTreeFromMatches(matchedEntries);
};

export const addItem = (priceData, path, type, formData) => {
  const newData = JSON.parse(JSON.stringify(priceData));

  let parent;
  if (path) {
    parent = getItemAtPath(newData, path);
  } else {
    parent = { children: newData };
  }

  if (type === "category") {
    const target = parent.children || parent;
    target[formData.name] = {
      type: "category",
      children: {},
    };
  } else if (type === "item") {
    const target = parent.children || parent;
    target[formData.name] = {
      type: "item",
      sell: parseFloat(formData.sell) || 0,
      cost: parseFloat(formData.cost) || 0,
      sellUnit: formData.sellUnit || "piece",
      costUnit: formData.costUnit || formData.sellUnit || "piece",
      notes: formData.notes || "",
    };
  }

  if (!path) {
    return parent.children;
  }
  return newData;
};

// =======================================================
// ITEM & CATEGORY EDIT UTILS (Order Preserving)
// =======================================================

const recursiveEditNode = (
  currentData,
  segments,
  originalName,
  newName,
  newItemData
) => {
  if (segments.length === 0) {
    const container = currentData.children || currentData;
    const newChildren = {};

    for (const [key, value] of Object.entries(container)) {
      if (key === originalName) {
        newChildren[newName] = newItemData(value);
      } else {
        newChildren[key] = value;
      }
    }

    if (currentData.children) {
      return { ...currentData, children: newChildren };
    } else {
      return newChildren;
    }
  }

  const segment = segments[0];
  const remainingSegments = segments.slice(1);
  const nextNode = currentData[segment] || currentData.children?.[segment];

  if (nextNode && nextNode.type === "category") {
    const updatedChild = recursiveEditNode(
      nextNode,
      remainingSegments,
      originalName,
      newName,
      newItemData
    );

    if (currentData[segment]) {
      return { ...currentData, [segment]: updatedChild };
    } else if (currentData.children?.[segment]) {
      return {
        ...currentData,
        children: {
          ...currentData.children,
          [segment]: updatedChild,
        },
      };
    }
  }

  return currentData;
};

export const editItem = (priceData, parentPath, originalName, newFormData) => {
  const newData = JSON.parse(JSON.stringify(priceData));
  const segments = parentPath.split(".").filter((s) => s);

  const result = recursiveEditNode(
    parentPath ? newData : { children: newData },
    segments,
    originalName,
    newFormData.name,
    (oldValue) => ({
      ...oldValue,
      sell: parseFloat(newFormData.sell) || 0,
      cost: parseFloat(newFormData.cost) || 0,
      sellUnit: newFormData.sellUnit || "piece",
      costUnit: newFormData.costUnit || newFormData.sellUnit || "piece",
      notes: newFormData.notes || "",
    })
  );

  return parentPath ? result : result.children;
};

export const editCategory = (priceData, categoryPath, newName) => {
  const newData = JSON.parse(JSON.stringify(priceData));
  const pathParts = categoryPath.split(".").filter((s) => s);
  const originalName = pathParts.pop();
  const parentPath = pathParts.join(".");

  const categoryData = getItemAtPath(newData, categoryPath);
  if (!categoryData) return priceData;

  const segments = parentPath.split(".").filter((s) => s);

  const result = recursiveEditNode(
    parentPath ? newData : { children: newData },
    segments,
    originalName,
    newName,
    () => categoryData
  );

  return parentPath ? result : result.children;
};

// =======================================================
// SORTING UTILS
// =======================================================

export const sortData = (data, sortType) => {
  const getSell = (node) => {
    if (!node) return NaN;
    if (node.type === "item")
      return Number.isFinite(Number(node.sell)) ? Number(node.sell) : NaN;
    return NaN;
  };

  const sortRecursiveWithStats = (childrenObj, parentNode) => {
    const childResults = {};

    Object.entries(childrenObj).forEach(([key, value]) => {
      if (key.startsWith("__")) return;

      if (value && value.type === "category" && value.children) {
        const { sortedObj, stats } = sortRecursiveWithStats(
          value.children,
          value
        );
        childResults[key] = {
          sortedValue: { ...value, children: sortedObj },
          stats,
        };
      } else {
        const sell = getSell(value);
        childResults[key] = {
          sortedValue: value,
          stats: {
            min: Number.isFinite(sell) ? sell : Infinity,
            max: Number.isFinite(sell) ? sell : -Infinity,
            hasItems: Number.isFinite(sell),
          },
        };
      }
    });

    const entries = Object.entries(childResults);

    const useSavedOrder =
      parentNode &&
      parentNode.__orderKeys &&
      (!sortType || sortType === "none");
    const orderKeys = useSavedOrder ? parentNode.__orderKeys : null;

    const sortEntries = (entriesArray) => {
      return entriesArray.sort(([keyA, a], [keyB, b]) => {
        const valueA = a.sortedValue;
        const valueB = b.sortedValue;

        if (useSavedOrder && orderKeys) {
          const indexA = orderKeys.indexOf(keyA);
          const indexB = orderKeys.indexOf(keyB);

          const effectiveIndexA = indexA === -1 ? Infinity : indexA;
          const effectiveIndexB = indexB === -1 ? Infinity : indexB;

          if (effectiveIndexA !== effectiveIndexB) {
            return effectiveIndexA - effectiveIndexB;
          }
        }

        const aIsCat = valueA && valueA.type === "category";
        const bIsCat = valueB && valueB.type === "category";

        if (!aIsCat && bIsCat) return -1;
        if (aIsCat && !bIsCat) return 1;

        const scoreA = valueA && valueA._matchScore ? valueA._matchScore : null;
        const scoreB = valueB && valueB._matchScore ? valueB._matchScore : null;
        if (scoreA !== null && scoreB !== null) {
          const scoreDiff = scoreB - scoreA;
          if (scoreDiff !== 0) return scoreDiff;
        }

        switch (sortType) {
          case "price-low": {
            if (!aIsCat && !bIsCat) {
              const aSell = getSell(valueA) || 0;
              const bSell = getSell(valueB) || 0;
              return aSell - bSell;
            }
            if (aIsCat && bIsCat) {
              const aMin = a.stats.min;
              const bMin = b.stats.min;
              if (aMin === bMin) return keyA.localeCompare(keyB);
              return aMin - bMin;
            }
            return String(keyA).localeCompare(String(keyB));
          }

          case "price-high": {
            if (!aIsCat && !bIsCat) {
              const aSell = getSell(valueA) || 0;
              const bSell = getSell(valueB) || 0;
              return bSell - aSell;
            }
            if (aIsCat && bIsCat) {
              const aMax = a.stats.max;
              const bMax = b.stats.max;
              if (aMax === bMax) return keyA.localeCompare(keyB);
              return bMax - aMax;
            }
            return String(keyA).localeCompare(String(keyB));
          }

          case "alphabetical":
            return String(keyA).localeCompare(String(keyB));
          case "alphabetical-reverse":
            return String(keyB).localeCompare(String(keyA));

          default:
            return String(keyA).localeCompare(String(keyB));
        }
      });
    };

    const sortedEntries = sortEntries(entries);

    const resultObj = {};
    sortedEntries.forEach(([key, entry]) => {
      resultObj[key] = entry.sortedValue;
    });

    let aggMin = Infinity;
    let aggMax = -Infinity;
    let aggHas = false;
    Object.values(childResults).forEach((e) => {
      if (e.stats && e.stats.hasItems) {
        aggHas = true;
        if (Number.isFinite(e.stats.min) && e.stats.min < aggMin)
          aggMin = e.stats.min;
        if (Number.isFinite(e.stats.max) && e.stats.max > aggMax)
          aggMax = e.stats.max;
      }
    });

    return {
      sortedObj: resultObj,
      stats: {
        min: aggHas ? aggMin : Infinity,
        max: aggHas ? aggMax : -Infinity,
        hasItems: aggHas,
      },
    };
  };

  const { sortedObj } = sortRecursiveWithStats(data, {
    __orderKeys: data.__orderKeys,
  });
  return sortedObj;
};

export const deleteItem = (priceData, path) => {
  const pathParts = path.split(".");
  const itemName = pathParts.pop();
  const parentPath = pathParts.join(".");

  let newData = JSON.parse(JSON.stringify(priceData));

  if (parentPath) {
    const parent = getItemAtPath(newData, parentPath);
    const container = parent.children || parent;
    delete container[itemName];
    return newData;
  } else {
    delete newData[itemName];
    return newData;
  }
};