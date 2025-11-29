export const getItemAtPath = (data, path) => {
  if (!path) return data;
  const parts = path.split(".");
  let current = data;
  for (const part of parts) {
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

// Comprehensive metric normalization
const createSearchVariants = (text) => {
  if (!text) return [""];

  let normalized = text.toLowerCase();

  // Length units - Imperial
  normalized = normalized
    .replace(/(\d+)\s*inch(es)?/gi, "$1inchunit")
    .replace(/(\d+)\s*"/g, "$1inchunit")
    .replace(/(\d+)"/g, "$1inchunit")
    .replace(/(\d+)\s*in\b/gi, "$1inchunit")
    .replace(/(\d+)\s*(?:foot|feet|ft)\b/gi, "$1footunit")
    .replace(/(\d+)\s*'/g, "$1footunit")
    .replace(/(\d+)'/g, "$1footunit")
    .replace(/(\d+)\s*(?:yard|yards|yd)\b/gi, "$1yardunit")
    .replace(/(\d+)\s*(?:mile|miles|mi)\b/gi, "$1mileunit");

  // Length units - Metric
  normalized = normalized
    .replace(
      /(\d+)\s*(?:millimeter|millimeters|millimetre|millimetres|mm)\b/gi,
      "$1mmunit"
    )
    .replace(
      /(\d+)\s*(?:centimeter|centimeters|centimetre|centimetres|cm)\b/gi,
      "$1cmunit"
    )
    .replace(/(\d+)\s*(?:meter|meters|metre|metres|m)\b/gi, "$1meterunit")
    .replace(
      /(\d+)\s*(?:kilometer|kilometers|kilometre|kilometres|km)\b/gi,
      "$1kmunit"
    );

  // Weight units - Imperial
  normalized = normalized
    .replace(/(\d+)\s*(?:ounce|ounces|oz)\b/gi, "$1ozunit")
    .replace(/(\d+)\s*(?:pound|pounds|lb|lbs)\b/gi, "$1lbunit")
    .replace(/(\d+)\s*(?:ton|tons)\b/gi, "$1tonunit");

  // Weight units - Metric
  normalized = normalized
    .replace(/(\d+)\s*(?:milligram|milligrams|mg)\b/gi, "$1mgunit")
    .replace(/(\d+)\s*(?:gram|grams|g|gm|gms)\b/gi, "$1gramunit")
    .replace(/(\d+)\s*(?:kilogram|kilograms|kg|kgs)\b/gi, "$1kgunit")
    .replace(/(\d+)\s*(?:tonne|tonnes|metric ton)\b/gi, "$1tonneunit");

  // Volume units - Imperial
  normalized = normalized
    .replace(
      /(\d+)\s*(?:fluid ounce|fluid ounces|fl oz|floz)\b/gi,
      "$1flozunit"
    )
    .replace(/(\d+)\s*(?:pint|pints|pt)\b/gi, "$1pintunit")
    .replace(/(\d+)\s*(?:quart|quarts|qt)\b/gi, "$1quartunit")
    .replace(/(\d+)\s*(?:gallon|gallons|gal)\b/gi, "$1gallonunit");

  // Volume units - Metric
  normalized = normalized
    .replace(
      /(\d+)\s*(?:milliliter|milliliters|millilitre|millilitres|ml)\b/gi,
      "$1mlunit"
    )
    .replace(/(\d+)\s*(?:liter|liters|litre|litres|l)\b/gi, "$1literunit");

  // Area units
  normalized = normalized
    .replace(
      /(\d+)\s*(?:square foot|square feet|sq ft|sqft|ft2|ft²)\b/gi,
      "$1sqftunit"
    )
    .replace(
      /(\d+)\s*(?:square meter|square metre|sq m|sqm|m2|m²)\b/gi,
      "$1sqmunit"
    )
    .replace(
      /(\d+)\s*(?:square inch|square inches|sq in|sqin|in2|in²)\b/gi,
      "$1sqinunit"
    )
    .replace(/(\d+)\s*(?:acre|acres)\b/gi, "$1acreunit")
    .replace(/(\d+)\s*(?:hectare|hectares|ha)\b/gi, "$1hectareunit");

  // Other common units
  normalized = normalized
    .replace(/(\d+)\s*(?:piece|pieces|pc|pcs)\b/gi, "$1pieceunit")
    .replace(/(\d+)\s*(?:box|boxes|bx)\b/gi, "$1boxunit")
    .replace(/(\d+)\s*(?:pack|packs|pk)\b/gi, "$1packunit")
    .replace(/(\d+)\s*(?:set|sets)\b/gi, "$1setunit")
    .replace(/(\d+)\s*(?:pair|pairs|pr)\b/gi, "$1pairunit")
    .replace(/(\d+)\s*(?:dozen|doz)\b/gi, "$1dozenunit")
    .replace(/(\d+)\s*(?:bag|bags)\b/gi, "$1bagunit")
    .replace(/(\d+)\s*(?:bottle|bottles|btl)\b/gi, "$1bottleunit")
    .replace(/(\d+)\s*(?:can|cans)\b/gi, "$1canunit")
    .replace(/(\d+)\s*(?:roll|rolls)\b/gi, "$1rollunit")
    .replace(/(\d+)\s*(?:sheet|sheets)\b/gi, "$1sheetunit");

  // Remove spaces
  normalized = normalized.replace(/\s+/g, "");

  return [normalized];
};

// Normalize item/category names consistently
const normalizeItemName = (text) => {
  if (!text) return "";

  let normalized = text.toLowerCase();

  // Length units - Imperial
  normalized = normalized
    .replace(/(\d+)\s*inch(es)?/gi, "$1inchunit")
    .replace(/(\d+)\s*"/g, "$1inchunit")
    .replace(/(\d+)"/g, "$1inchunit")
    .replace(/(\d+)\s*in\b/gi, "$1inchunit")
    .replace(/(\d+)\s*(?:foot|feet|ft)\b/gi, "$1footunit")
    .replace(/(\d+)\s*'/g, "$1footunit")
    .replace(/(\d+)'/g, "$1footunit")
    .replace(/(\d+)\s*(?:yard|yards|yd)\b/gi, "$1yardunit")
    .replace(/(\d+)\s*(?:mile|miles|mi)\b/gi, "$1mileunit");

  // Length units - Metric
  normalized = normalized
    .replace(
      /(\d+)\s*(?:millimeter|millimeters|millimetre|millimetres|mm)\b/gi,
      "$1mmunit"
    )
    .replace(
      /(\d+)\s*(?:centimeter|centimeters|centimetre|centimetres|cm)\b/gi,
      "$1cmunit"
    )
    .replace(/(\d+)\s*(?:meter|meters|metre|metres|m)\b/gi, "$1meterunit")
    .replace(
      /(\d+)\s*(?:kilometer|kilometers|kilometre|kilometres|km)\b/gi,
      "$1kmunit"
    );

  // Weight units - Imperial
  normalized = normalized
    .replace(/(\d+)\s*(?:ounce|ounces|oz)\b/gi, "$1ozunit")
    .replace(/(\d+)\s*(?:pound|pounds|lb|lbs)\b/gi, "$1lbunit")
    .replace(/(\d+)\s*(?:ton|tons)\b/gi, "$1tonunit");

  // Weight units - Metric
  normalized = normalized
    .replace(/(\d+)\s*(?:milligram|milligrams|mg)\b/gi, "$1mgunit")
    .replace(/(\d+)\s*(?:gram|grams|g|gm|gms)\b/gi, "$1gramunit")
    .replace(/(\d+)\s*(?:kilogram|kilograms|kg|kgs)\b/gi, "$1kgunit")
    .replace(/(\d+)\s*(?:tonne|tonnes|metric ton)\b/gi, "$1tonneunit");

  // Volume units - Imperial
  normalized = normalized
    .replace(
      /(\d+)\s*(?:fluid ounce|fluid ounces|fl oz|floz)\b/gi,
      "$1flozunit"
    )
    .replace(/(\d+)\s*(?:pint|pints|pt)\b/gi, "$1pintunit")
    .replace(/(\d+)\s*(?:quart|quarts|qt)\b/gi, "$1quartunit")
    .replace(/(\d+)\s*(?:gallon|gallons|gal)\b/gi, "$1gallonunit");

  // Volume units - Metric
  normalized = normalized
    .replace(
      /(\d+)\s*(?:milliliter|milliliters|millilitre|millilitres|ml)\b/gi,
      "$1mlunit"
    )
    .replace(/(\d+)\s*(?:liter|liters|litre|litres|l)\b/gi, "$1literunit");

  // Area units
  normalized = normalized
    .replace(
      /(\d+)\s*(?:square foot|square feet|sq ft|sqft|ft2|ft²)\b/gi,
      "$1sqftunit"
    )
    .replace(
      /(\d+)\s*(?:square meter|square metre|sq m|sqm|m2|m²)\b/gi,
      "$1sqmunit"
    )
    .replace(
      /(\d+)\s*(?:square inch|square inches|sq in|sqin|in2|in²)\b/gi,
      "$1sqinunit"
    )
    .replace(/(\d+)\s*(?:acre|acres)\b/gi, "$1acreunit")
    .replace(/(\d+)\s*(?:hectare|hectares|ha)\b/gi, "$1hectareunit");

  // Other common units
  normalized = normalized
    .replace(/(\d+)\s*(?:piece|pieces|pc|pcs)\b/gi, "$1pieceunit")
    .replace(/(\d+)\s*(?:box|boxes|bx)\b/gi, "$1boxunit")
    .replace(/(\d+)\s*(?:pack|packs|pk)\b/gi, "$1packunit")
    .replace(/(\d+)\s*(?:set|sets)\b/gi, "$1setunit")
    .replace(/(\d+)\s*(?:pair|pairs|pr)\b/gi, "$1pairunit")
    .replace(/(\d+)\s*(?:dozen|doz)\b/gi, "$1dozenunit")
    .replace(/(\d+)\s*(?:bag|bags)\b/gi, "$1bagunit")
    .replace(/(\d+)\s*(?:bottle|bottles|btl)\b/gi, "$1bottleunit")
    .replace(/(\d+)\s*(?:can|cans)\b/gi, "$1canunit")
    .replace(/(\d+)\s*(?:roll|rolls)\b/gi, "$1rollunit")
    .replace(/(\d+)\s*(?:sheet|sheets)\b/gi, "$1sheetunit");

  // Remove spaces and special characters
  return normalized
    .replace(/\s+/g, "")
    .replace(/["'`´'']/g, "")
    .replace(/[^\w]/g, "");
};

export const filterData = (data, search) => {
  if (!search) return data;

  const searchNormalized = createSearchVariants(search)[0];

  const searchInObject = (obj, parentMatches = false, pathSoFar = "") => {
    const result = {};

    Object.entries(obj).forEach(([key, value]) => {
      const keyNormalized = normalizeItemName(key);
      const currentPath = pathSoFar ? pathSoFar + keyNormalized : keyNormalized;

      const keyMatches = keyNormalized.includes(searchNormalized);
      const pathMatches = currentPath.includes(searchNormalized);
      const shouldInclude = parentMatches || keyMatches || pathMatches;

      if (value.type === "category") {
        const childResults = searchInObject(
          value.children || {},
          shouldInclude,
          currentPath
        );
        const hasMatchingChildren = Object.keys(childResults).length > 0;

        if (keyMatches || pathMatches || hasMatchingChildren || parentMatches) {
          result[key] = {
            ...value,
            children: hasMatchingChildren ? childResults : value.children,
          };
        }
      } else if (value.type === "item") {
        if (shouldInclude) {
          result[key] = value;
        }
      }
    });

    return result;
  };

  return searchInObject(data);
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
  const sorted = {};

  const sortEntries = (entries) => {
    return entries.sort(([keyA, valueA], [keyB, valueB]) => {
      // Categories always come before items
      if (valueA.type === "category" && valueB.type === "item") return -1;
      if (valueA.type === "item" && valueB.type === "category") return 1;

      switch (sortType) {
        case "alphabetical":
          return keyA.localeCompare(keyB);
        case "alphabetical-reverse":
          return keyB.localeCompare(keyA);
        case "price-low":
          if (valueA.type === "item" && valueB.type === "item") {
            return (valueA.sell || 0) - (valueB.sell || 0);
          }
          return keyA.localeCompare(keyB);
        case "price-high":
          if (valueA.type === "item" && valueB.type === "item") {
            return (valueB.sell || 0) - (valueA.sell || 0);
          }
          return keyA.localeCompare(keyB);
        default:
          return 0;
      }
    });
  };

  const sortRecursive = (obj) => {
    const result = {};
    const entries = Object.entries(obj);
    const sortedEntries = sortEntries(entries);

    sortedEntries.forEach(([key, value]) => {
      if (value.type === "category" && value.children) {
        result[key] = {
          ...value,
          children: sortRecursive(value.children),
        };
      } else {
        result[key] = value;
      }
    });

    return result;
  };

  return sortRecursive(data);
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
