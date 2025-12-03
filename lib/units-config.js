// lib/units-config.js

// Each unit has a primary name (what's stored) and aliases (for search)
export const UNIT_CATEGORIES = {
  Length: [
    {
      name: "millimeter",
      aliases: ["mm", "millimetre", "millimetres", "millimeters"],
    },
    {
      name: "centimeter",
      aliases: ["cm", "centimetre", "centimetres", "centimeters"],
    },
    { name: "meter", aliases: ["m", "metre", "metres", "meters"] },
    {
      name: "kilometer",
      aliases: ["km", "kilometre", "kilometres", "kilometers"],
    },
    { name: "inch", aliases: ["in", "inches"] },
    { name: "foot", aliases: ["ft", "feet"] },
    { name: "yard", aliases: ["yd", "yards"] },
    { name: "mile", aliases: ["mi", "miles"] },
  ],
  Weight: [
    { name: "milligram", aliases: ["mg", "milligrams"] },
    { name: "gram", aliases: ["g", "gm", "grams"] },
    { name: "kilogram", aliases: ["kg", "kgs", "kilograms"] },
    { name: "ton", aliases: ["tons", "tonne", "tonnes"] },
    { name: "pound", aliases: ["lb", "lbs", "pounds"] },
    { name: "ounce", aliases: ["oz", "ounces"] },
  ],
  Volume: [
    {
      name: "milliliter",
      aliases: ["ml", "millilitre", "millilitres", "milliliters"],
    },
    { name: "liter", aliases: ["l", "ltr", "litre", "litres", "liters"] },
    { name: "gallon", aliases: ["gal", "gallons"] },
  ],
  Area: [
    {
      name: "square meter",
      aliases: ["sqm", "sq m", "m2", "m²", "square meters"],
    },
    {
      name: "square foot",
      aliases: ["sqft", "sq ft", "ft2", "ft²", "square feet"],
    },
    {
      name: "square yard",
      aliases: ["sqyd", "sq yd", "yd2", "yd²", "square yards"],
    },
  ],
  Time: [
    { name: "second", aliases: ["sec", "secs", "seconds"] },
    { name: "minute", aliases: ["min", "mins", "minutes"] },
    { name: "hour", aliases: ["hr", "hrs", "hours"] },
    { name: "day", aliases: ["days"] },
  ],
  Count: [
    { name: "piece", aliases: ["pc", "pcs", "pieces"] },
    { name: "pair", aliases: ["pairs"] },
    { name: "dozen", aliases: ["doz"] },
    { name: "gross", aliases: [] },
    { name: "box", aliases: ["boxes"] },
    { name: "set", aliases: ["sets"] },
    { name: "bag", aliases: ["bags"] },
    { name: "pack", aliases: ["packs"] },
    { name: "carton", aliases: ["cartons"] },
    { name: "bundle", aliases: ["bundles"] },
  ],
};

export const DEFAULT_ACTIVE_UNITS = [
  "piece",
  "meter",
  "kilogram",
  "liter",
  "box",
  "set",
  "bag",
];

// Get all unit names (primary only)
export const getAllUnitNames = () => {
  return Object.values(UNIT_CATEGORIES)
    .flat()
    .map((unit) => unit.name);
};

// Create a map for easy lookup: alias -> primary name
export const createUnitAliasMap = () => {
  const map = {};

  Object.values(UNIT_CATEGORIES)
    .flat()
    .forEach((unit) => {
      // Map the name to itself
      map[unit.name.toLowerCase()] = unit.name;

      // Map all aliases to the primary name
      unit.aliases.forEach((alias) => {
        map[alias.toLowerCase()] = unit.name;
      });
    });

  return map;
};

// Helper function to normalize a unit (convert alias to primary name)
export const normalizeUnit = (unit) => {
  const aliasMap = createUnitAliasMap();
  return aliasMap[unit.toLowerCase()] || unit;
};

// Helper function to check if unit matches search query (checks name + aliases)
export const unitMatchesQuery = (unit, query) => {
  const lowerQuery = query.toLowerCase();
  return (
    unit.name.toLowerCase().includes(lowerQuery) ||
    unit.aliases.some((alias) => alias.toLowerCase().includes(lowerQuery))
  );
};
