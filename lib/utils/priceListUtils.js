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
   - Handles:
     * simple fractions 1/2
     * reducer notations 1/2-3/4 or 3/4"-1/2"
     * numeric tokens (with fuzzy + exact match scoring)
     * unit tokens (inch, mm, etc.)
     * alpha tokens (prefix + fuzzy matching)
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
 * - No mixed fraction expansion
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

  // split on non-alphanumeric (but preserve placeholders)
  const rawParts = s.split(/[^a-z0-9_]+/i).filter(Boolean);

  const tokens = [];
  for (const p of rawParts) {
    const ph = placeholders.find((x) => x.ph === p);
    if (ph) {
      tokens.push(ph.val);
      // For reducer, DON'T add individual fractions to avoid false matches
      // e.g., searching "1" shouldn't match "3/4"-1/2"
      // if (ph.fractions) {
      //   tokens.push(...ph.fractions);
      // }
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

/* Token match rules with scoring:
   - Exact match: score 10 (highest priority)
   - Reducer match: score 8 (e.g., 1/2-3/4 matches 3/4"-1/2")
   - Fraction containment: score 7
   - Word boundary match: score 6 (standalone word match)
   - Prefix match: score 5
   - Substring match: score 3 (min 4 chars, for longer words)
   - Fuzzy match (1-2 char distance): score 2
   Returns 0 for no match
*/
const matchTokenAgainst = (searchToken, pathToken) => {
  if (!searchToken || !pathToken) return 0;

  // EXACT MATCH - highest priority
  if (pathToken === searchToken) return 10;

  // REDUCER NOTATION HANDLING
  // If search is reducer (1/2-3/4), match against path with any order/format
  if (isReducer(searchToken)) {
    const [f1, f2] = searchToken.split("-");
    // Match 1/2-3/4 or 3/4-1/2 (order independent)
    if (
      (pathToken.includes(f1) && pathToken.includes(f2)) ||
      pathToken === `${f2}-${f1}`
    ) {
      return 8;
    }
  }

  // If path is reducer format, only match if search is also a reducer or exact fraction match
  if (isReducer(pathToken)) {
    if (isFraction(searchToken)) {
      // Only match if it's the exact fraction, not a substring
      // e.g., "1/2" should match "1/2-3/4" but "1" should NOT
      return pathToken === searchToken ||
        pathToken.split("-").includes(searchToken)
        ? 7
        : 0;
    }
    return 0; // Don't match numeric "1" against "1/2-3/4"
  }

  // FRACTION MATCHING
  if (isFraction(searchToken)) {
    // Check if path contains this exact fraction (for items like 3/4"-1/2")
    if (pathToken.includes(searchToken)) return 7;
    return 0; // Fractions should match exactly or be contained, no fuzzy
  }

  // NUMERIC MATCHING - exact only for sizes
  if (isNumeric(searchToken)) {
    // Don't do fuzzy matching on numbers to avoid confusion
    // "1" should not match "10" or "12"
    return 0;
  }

  // ALPHA/ALNUM TOKEN MATCHING

  // Prefix match
  if (pathToken.startsWith(searchToken)) return 5;

  // Word boundary match - searchToken is complete word in pathToken
  // Helps distinguish "mta" from "fta"
  const wordBoundaryRegex = new RegExp(`\\b${searchToken}\\b`, "i");
  if (wordBoundaryRegex.test(pathToken)) return 6;

  // Substring match (min 4 chars to avoid "mta" matching "fta")
  // Only for longer search terms where substring makes sense
  if (searchToken.length >= 4 && pathToken.includes(searchToken)) return 3;

  // FUZZY MATCH - for typos (min 4 chars, max 2 edit distance)
  if (searchToken.length >= 4) {
    const distance = levenshtein(searchToken, pathToken);
    const maxDistance = Math.min(2, Math.floor(searchToken.length / 3));
    if (distance <= maxDistance) {
      return 2; // fuzzy match score
    }
  }

  return 0;
};

/* ---------------------------
   Flatten data into list of entries with token arrays
   Each entry: { keyPath: ['Parent','Child','item'], pathTokens: [...], node, rawKey }
   --------------------------- */
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

/* Build result tree from matched entries with scores
 */
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
              _matchScore: m.score, // store score for sorting
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

/* ---------------------------
   Main filterData: scored AND-match across path tokens
   - All search tokens must match (AND logic)
   - Results sorted by relevance score
   - Exact matches prioritized over fuzzy
   --------------------------- */
export const filterData = (data, search) => {
  if (!search) return data;

  const searchTokens = tokenize(search);
  if (searchTokens.length === 0) return {};

  const entries = flattenData(data);

  const matchedEntries = [];

  for (const entry of entries) {
    let totalScore = 0;
    let allMatched = true;

    // Each search token must match at least one path token
    for (const st of searchTokens) {
      let bestScore = 0;
      for (const pt of entry.pathTokens) {
        const score = matchTokenAgainst(st, pt);
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

  // Sort by score (highest first)
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
    };
  }

  if (!path) {
    return parent.children;
  }
  return newData;
};

export const editItem = (priceData, editingPath, formData) => {
  const pathParts = editingPath.split(".");
  const oldName = pathParts.pop();
  const parentPath = pathParts.join(".");

  let newData = JSON.parse(JSON.stringify(priceData));

  let parent;
  if (parentPath) {
    parent = getItemAtPath(newData, parentPath);
  } else {
    parent = { children: newData };
  }

  const container = parent.children || parent;
  const oldItem = container[oldName];

  delete container[oldName];

  container[formData.name] = {
    ...oldItem,
    sell: parseFloat(formData.sell) || 0,
    cost: parseFloat(formData.cost) || 0,
    sellUnit: formData.sellUnit || "piece",
    costUnit: formData.costUnit || formData.sellUnit || "piece",
  };

  if (!parentPath) {
    return container;
  }
  return newData;
};

export const sortData = (data, sortType) => {
  // Helper: get numeric sell price safe
  const getSell = (node) => {
    if (!node) return NaN;
    if (node.type === "item")
      return Number.isFinite(Number(node.sell)) ? Number(node.sell) : NaN;
    return NaN;
  };

  // Recursively sort children and compute aggregate price stats for categories.
  // Returns { sortedObj, stats } where stats = { min: number, max: number, hasItems: bool }
  const sortRecursiveWithStats = (obj) => {
    // First recurse into children so we have stats for subcategories
    const childResults = {}; // key -> { sortedValue, stats }
    Object.entries(obj).forEach(([key, value]) => {
      if (value && value.type === "category" && value.children) {
        const { sortedObj, stats } = sortRecursiveWithStats(value.children);
        // copy category but replace children with sorted children
        childResults[key] = {
          sortedValue: { ...value, children: sortedObj },
          stats,
        };
      } else {
        // items or empty category
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

    // Helper to compute aggregate stats for a category key
    const computeStatsForKey = (key, entry) => {
      if (!entry) return { min: Infinity, max: -Infinity, hasItems: false };
      return entry.stats;
    };

    // Prepare entries array for sorting: [key, { sortedValue, stats }]
    const entries = Object.entries(childResults);

    const sortEntries = (entriesArray) => {
      return entriesArray.sort(([keyA, a], [keyB, b]) => {
        const valueA = a.sortedValue;
        const valueB = b.sortedValue;

        // Categories always come before items
        const aIsCat = valueA && valueA.type === "category";
        const bIsCat = valueB && valueB.type === "category";
        if (aIsCat && !bIsCat) return -1;
        if (!aIsCat && bIsCat) return 1;

        // If both have _matchScore use it (higher score first)
        const scoreA = valueA && valueA._matchScore ? valueA._matchScore : null;
        const scoreB = valueB && valueB._matchScore ? valueB._matchScore : null;
        if (scoreA !== null && scoreB !== null) {
          const scoreDiff = scoreB - scoreA;
          if (scoreDiff !== 0) return scoreDiff;
        }

        // Price sort behaviors
        switch (sortType) {
          case "price-low": {
            if (!aIsCat && !bIsCat) {
              // both items: by item sell ascending
              const aSell = getSell(valueA) || 0;
              const bSell = getSell(valueB) || 0;
              return aSell - bSell;
            }

            if (aIsCat && bIsCat) {
              // both categories: compare min price (categories with no items go last)
              const aMin = a.stats.min;
              const bMin = b.stats.min;
              // treat Infinity as very large so empty categories go to end
              if (aMin === bMin) return keyA.localeCompare(keyB);
              return aMin - bMin;
            }

            // mixed (shouldn't happen due to category-before-item above), fallback alphabetical
            return String(keyA).localeCompare(String(keyB));
          }

          case "price-high": {
            if (!aIsCat && !bIsCat) {
              // both items: by item sell descending
              const aSell = getSell(valueA) || 0;
              const bSell = getSell(valueB) || 0;
              return bSell - aSell;
            }

            if (aIsCat && bIsCat) {
              // both categories: compare max price (empty categories have -Infinity and go last)
              const aMax = a.stats.max;
              const bMax = b.stats.max;
              if (aMax === bMax) return keyA.localeCompare(keyB);
              return bMax - aMax; // descending
            }

            // mixed fallback
            return String(keyA).localeCompare(String(keyB));
          }

          case "alphabetical":
            return String(keyA).localeCompare(String(keyB));
          case "alphabetical-reverse":
            return String(keyB).localeCompare(String(keyA));
          default:
            return 0;
        }
      });
    };

    const sortedEntries = sortEntries(entries);

    // Build resulting sorted object and compute aggregate stats for this level
    const resultObj = {};
    // Stats for this container (not used by parent directly; parents compute their stats from children)
    // But we still compute per-key stats above.
    sortedEntries.forEach(([key, entry]) => {
      resultObj[key] = entry.sortedValue;
    });

    // For each key, its stats available in childResults[key].stats already
    // Return sorted object and nothing else (parent will use per-key stats from entries)
    // But we need to provide aggregate stats for the caller when this level is a category itself.
    // Compute aggregate min/max/hasItems for this level:
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

    const statsForThisLevel = {
      min: aggHas ? aggMin : Infinity,
      max: aggHas ? aggMax : -Infinity,
      hasItems: aggHas,
    };

    return { sortedObj: resultObj, stats: statsForThisLevel };
  };

  // top-level call; we only need the sorted object
  const { sortedObj } = sortRecursiveWithStats(data);
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
