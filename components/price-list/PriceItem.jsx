import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeUnit } from "@/lib/units-config";

const convertPrice = (pricePerUnit, fromUnit, toUnit) => {
  const fromLower = fromUnit.toLowerCase().trim();
  const toLower = toUnit.toLowerCase().trim();

  if (fromLower === toLower) {
    return pricePerUnit;
  }

  // Weight conversions (relative to grams)
  const weightUnits = {
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

  // Length conversions (relative to meters)
  const lengthUnits = {
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

  // Volume conversions (relative to liters)
  const volumeUnits = {
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

  // Area conversions (relative to square meters)
  const areaUnits = {
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

  // Time conversions (relative to hours)
  const timeUnits = {
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

  // Count conversions (relative to pieces)
  const countUnits = {
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

  // Find which category the units belong to
  let fromValue, toValue;

  if (weightUnits[fromLower] && weightUnits[toLower]) {
    fromValue = weightUnits[fromLower];
    toValue = weightUnits[toLower];
  } else if (lengthUnits[fromLower] && lengthUnits[toLower]) {
    fromValue = lengthUnits[fromLower];
    toValue = lengthUnits[toLower];
  } else if (volumeUnits[fromLower] && volumeUnits[toLower]) {
    fromValue = volumeUnits[fromLower];
    toValue = volumeUnits[toLower];
  } else if (areaUnits[fromLower] && areaUnits[toLower]) {
    fromValue = areaUnits[fromLower];
    toValue = areaUnits[toLower];
  } else if (timeUnits[fromLower] && timeUnits[toLower]) {
    fromValue = timeUnits[fromLower];
    toValue = timeUnits[toLower];
  } else if (countUnits[fromLower] && countUnits[toLower]) {
    fromValue = countUnits[fromLower];
    toValue = countUnits[toLower];
  } else {
    return null; // Cannot convert
  }

  // Convert price: if price is ₹2/ft and we want ₹?/m
  // 1m = 3.28084ft, so price per meter = price per ft × (toValue / fromValue)
  return pricePerUnit * (toValue / fromValue);
};

const calculateProfitWithConversion = (sell, sellUnit, cost, costUnit) => {
  // Convert cost price to sell unit
  const costInSellUnit = convertPrice(cost, costUnit, sellUnit);

  if (costInSellUnit !== null) {
    const profit = sell - costInSellUnit;
    const profitPercent =
      costInSellUnit > 0 ? ((profit / costInSellUnit) * 100).toFixed(1) : 0;
    return {
      success: true,
      profit: profit.toFixed(2),
      profitPercent: profitPercent,
      sellUnit: sellUnit,
    };
  }

  return { success: false };
};

export const PriceItem = ({
  isLast,
  name,
  path,
  item,
  priceView,
  sellPriceMode,
  editMode,
  onEdit,
  onDelete,
  onViewDetails,
}) => {
  // Normalize units (convert aliases to primary names)
  const sellUnit = normalizeUnit(item.sellUnit || "piece");
  const costUnit = normalizeUnit(item.costUnit || item.sellUnit || "piece");

  // Handle backward compatibility: use retailSell if available, else fall back to sell
  const retailSell = item.retailSell !== undefined ? item.retailSell : item.sell || 0;
  const bulkSell = item.bulkSell !== undefined ? item.bulkSell : retailSell;

  // Determine which sell price to use based on mode
  const currentSellPrice = sellPriceMode === "bulk" ? bulkSell : retailSell;

  let displayValue;
  
  if (priceView === "sell") {
    displayValue = `₹${currentSellPrice}/${sellUnit}`;
  } else if (priceView === "cost") {
    displayValue = `₹${item.cost}/${costUnit}`;
  } else if (priceView === "profit") {
    // Calculate profit using the current sell price mode
    if (sellUnit.toLowerCase() === costUnit.toLowerCase()) {
      const profit = currentSellPrice - item.cost;
      const profitPercent =
        item.cost > 0 ? ((profit / item.cost) * 100).toFixed(1) : 0;
      displayValue = `₹${profit} (${profitPercent}%)`;
    } else {
      const conversionResult = calculateProfitWithConversion(
        currentSellPrice,
        sellUnit,
        item.cost,
        costUnit
      );

      if (conversionResult.success) {
        displayValue = `₹${conversionResult.profit} (${conversionResult.profitPercent}%) (per ${conversionResult.sellUnit})`;
      } else {
        displayValue = `N/A (different units)`;
      }
    }
  }

  const isClickable = !editMode;

  return (
    <div
      className={`rounded-lg px-1 py-2.5 flex justify-between items-center mb-2 gap-2 ${
        isLast ? "" : "border-b"
      } ${
        isClickable
          ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          : ""
      }`}
      onClick={() => isClickable && onViewDetails(name, item)}
    >
      <span className="flex-1">{name}</span>
      <div className="flex items-center gap-3">
        <span className="font-semibold">{displayValue}</span>
        {editMode && (
          <div className="flex gap-2">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(path, item);
              }}
              variant="ghost"
              size="icon"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              onClick={(e) => onDelete(path, e)}
              variant="ghost"
              size="icon"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};