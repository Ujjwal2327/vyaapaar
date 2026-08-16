// lib/utils/unitConversion.js
//
// Shared numeric conversion tables. The exact same factors already exist
// twice — duplicated inside PriceItem.jsx and ItemDetailModal.jsx — to
// convert a price from one unit to another for the profit/cost view. This
// file is that logic pulled out once, plus two new functions the
// marketplace needs: convertQuantity (the inverse operation — "how much
// of X is 10 metres if X is priced by the foot") and getCompatibleUnits,
// which leans on the existing lib/units-config.js categories so the
// calculator's unit dropdown uses the same names your catalog already
// does, instead of inventing a second list.
//
// Nothing in PriceItem.jsx / ItemDetailModal.jsx needs to change — they
// can keep their own copies, or be pointed at this file later. This is
// additive only.

import { UNIT_CATEGORIES, normalizeUnit } from "@/lib/units-config";

export const WEIGHT_UNITS = {
  mg: 0.001,
  milligram: 0.001,
  milligrams: 0.001,
  g: 1,
  gm: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kgs: 1000,
  kilogram: 1000,
  kilograms: 1000,
  ton: 1000000,
  tons: 1000000,
  tonne: 1000000,
  tonnes: 1000000,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
};

export const LENGTH_UNITS = {
  mm: 0.001,
  millimeter: 0.001,
  millimeters: 0.001,
  millimetre: 0.001,
  millimetres: 0.001,
  cm: 0.01,
  centimeter: 0.01,
  centimeters: 0.01,
  centimetre: 0.01,
  centimetres: 0.01,
  m: 1,
  meter: 1,
  meters: 1,
  metre: 1,
  metres: 1,
  km: 1000,
  kilometer: 1000,
  kilometers: 1000,
  kilometre: 1000,
  kilometres: 1000,
  in: 0.0254,
  inch: 0.0254,
  inches: 0.0254,
  ft: 0.3048,
  foot: 0.3048,
  feet: 0.3048,
  yd: 0.9144,
  yard: 0.9144,
  yards: 0.9144,
  mi: 1609.34,
  mile: 1609.34,
  miles: 1609.34,
};

export const VOLUME_UNITS = {
  ml: 0.001,
  milliliter: 0.001,
  milliliters: 0.001,
  millilitre: 0.001,
  millilitres: 0.001,
  l: 1,
  ltr: 1,
  liter: 1,
  liters: 1,
  litre: 1,
  litres: 1,
  gal: 3.78541,
  gallon: 3.78541,
  gallons: 3.78541,
};

export const AREA_UNITS = {
  sqm: 1,
  "sq m": 1,
  "square meter": 1,
  "square meters": 1,
  m2: 1,
  "m²": 1,
  sqft: 0.092903,
  "sq ft": 0.092903,
  "square foot": 0.092903,
  "square feet": 0.092903,
  ft2: 0.092903,
  "ft²": 0.092903,
  sqyd: 0.836127,
  "sq yd": 0.836127,
  "square yard": 0.836127,
  "square yards": 0.836127,
  yd2: 0.836127,
  "yd²": 0.836127,
};

export const TIME_UNITS = {
  sec: 1 / 3600,
  secs: 1 / 3600,
  second: 1 / 3600,
  seconds: 1 / 3600,
  min: 1 / 60,
  mins: 1 / 60,
  minute: 1 / 60,
  minutes: 1 / 60,
  hr: 1,
  hrs: 1,
  hour: 1,
  hours: 1,
  day: 24,
  days: 24,
};

export const COUNT_UNITS = {
  piece: 1,
  pieces: 1,
  pc: 1,
  pcs: 1,
  pair: 2,
  pairs: 2,
  dozen: 12,
  doz: 12,
  gross: 144,
  box: 1,
  boxes: 1,
  set: 1,
  sets: 1,
  bag: 1,
  bags: 1,
  pack: 1,
  packs: 1,
  carton: 1,
  cartons: 1,
  bundle: 1,
  bundles: 1,
};

const UNIT_TABLES = [
  WEIGHT_UNITS,
  LENGTH_UNITS,
  VOLUME_UNITS,
  AREA_UNITS,
  TIME_UNITS,
  COUNT_UNITS,
];

const findSharedTable = (fromUnit, toUnit) => {
  const fromLower = (fromUnit || "").toLowerCase().trim();
  const toLower = (toUnit || "").toLowerCase().trim();
  return (
    UNIT_TABLES.find(
      (t) => t[fromLower] !== undefined && t[toLower] !== undefined,
    ) ?? null
  );
};

/**
 * Convert a price-per-unit from one unit to another. Same behaviour as the
 * convertPrice() already duplicated in PriceItem.jsx / ItemDetailModal.jsx.
 * Returns null when the two units aren't in the same category (can't be
 * converted).
 */
export const convertPrice = (pricePerUnit, fromUnit, toUnit) => {
  const fromLower = (fromUnit || "").toLowerCase().trim();
  const toLower = (toUnit || "").toLowerCase().trim();
  if (fromLower === toLower) return pricePerUnit;

  const table = findSharedTable(fromUnit, toUnit);
  if (!table) return null;

  return pricePerUnit * (table[toLower] / table[fromLower]);
};

/**
 * Convert a quantity from one unit to another, e.g.
 * convertQuantity(10, "meter", "foot") -> 32.8 (10 metres is 32.8 feet).
 * This is the operation the Material Calculator needs: the customer knows
 * how much they want in a unit that's convenient for them, and we need the
 * equivalent in the item's actual sell unit. Returns null when the two
 * units aren't in the same category.
 */
export const convertQuantity = (quantity, fromUnit, toUnit) => {
  const fromLower = (fromUnit || "").toLowerCase().trim();
  const toLower = (toUnit || "").toLowerCase().trim();
  if (fromLower === toLower) return quantity;

  const table = findSharedTable(fromUnit, toUnit);
  if (!table) return null;

  return quantity * (table[fromLower] / table[toLower]);
};

/**
 * Every unit name (primary spellings only, no duplicate aliases) that a
 * given unit can be converted to or from — reuses lib/units-config.js's
 * existing category grouping so the calculator's dropdown matches the
 * spellings already used across the rest of the catalog, instead of a
 * second, competing list of unit names.
 */
export const getCompatibleUnits = (unit) => {
  const primary = normalizeUnit(unit || "piece");
  for (const units of Object.values(UNIT_CATEGORIES)) {
    if (units.some((u) => u.name === primary)) {
      return units.map((u) => u.name);
    }
  }
  return [primary];
};
