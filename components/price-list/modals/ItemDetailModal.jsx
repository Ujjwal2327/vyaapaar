import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { normalizeUnit } from "@/lib/units-config";

// Helper function to convert prices between units (same as in PriceItem)
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

export const ItemDetailModal = ({
  open,
  onOpenChange,
  itemData,
  itemName,
  sellPriceMode,
}) => {
  const [showCostProfit, setShowCostProfit] = useState(false);

  // Load showCostProfit setting from localStorage
  useEffect(() => {
    const savedShowCostProfit = localStorage.getItem("showCostProfit");
    setShowCostProfit(savedShowCostProfit === "true");
  }, [open]);

  if (!itemData) return null;

  // Handle backward compatibility: use retailSell if available, else fall back to sell
  const retailSell =
    itemData.retailSell !== undefined
      ? itemData.retailSell
      : itemData.sell || 0;
  const bulkSell =
    itemData.bulkSell !== undefined ? itemData.bulkSell : retailSell;
  const {
    cost,
    sellUnit: rawSellUnit,
    costUnit: rawCostUnit,
    notes,
  } = itemData;

  // Normalize units (convert aliases to primary names)
  const sellUnit = normalizeUnit(rawSellUnit || "piece");
  const costUnit = normalizeUnit(rawCostUnit || rawSellUnit || "piece");

  // Determine which sell price to use based on mode
  const currentSellPrice = sellPriceMode === "bulk" ? bulkSell : retailSell;

  // Function to format the price display
  const formatPrice = (price, unit) => {
    return `₹${price} / ${unit}`;
  };

  // Calculate profit
  let profitInfo = null;
  if (showCostProfit && cost !== undefined) {
    if (sellUnit.toLowerCase() === costUnit.toLowerCase()) {
      const profit = currentSellPrice - cost;
      const profitPercent = cost > 0 ? ((profit / cost) * 100).toFixed(1) : 0;
      profitInfo = {
        success: true,
        profit: profit.toFixed(2),
        profitPercent: profitPercent,
        sellUnit: sellUnit,
      };
    } else {
      profitInfo = calculateProfitWithConversion(
        currentSellPrice,
        sellUnit,
        cost,
        costUnit,
      );
    }
  }

  // Check if retail and bulk are different
  const hasDifferentBulkPrice = retailSell !== bulkSell;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{itemName}</DialogTitle>
          <DialogDescription>
            Detailed pricing and specification information.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Sell Price */}
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-primary">
              {!hasDifferentBulkPrice
                ? "Sell Price"
                : sellPriceMode === "retail"
                  ? "Retail Sell Price"
                  : "Bulk Sell Price"}
            </span>
            <span className="text-lg font-bold">
              {formatPrice(currentSellPrice, sellUnit)}
            </span>
          </div>

          {/* Show both prices if they're different */}
          {hasDifferentBulkPrice && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                {sellPriceMode === "retail"
                  ? "Bulk Sell Price"
                  : "Retail Sell Price"}
              </span>
              <span className="font-medium text-muted-foreground">
                {sellPriceMode === "retail"
                  ? formatPrice(bulkSell, sellUnit)
                  : formatPrice(retailSell, sellUnit)}
              </span>
            </div>
          )}

          {/* Cost Price - Only show if showCostProfit is enabled */}
          {showCostProfit && cost !== undefined && (
            <>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Cost Price</span>
                <span className="text-lg font-bold">
                  {formatPrice(cost, costUnit)}
                </span>
              </div>
            </>
          )}

          {/* Profit - Only show if showCostProfit is enabled */}
          {showCostProfit && profitInfo && (
            <>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Profit</span>
                <div className="text-right">
                  {profitInfo.success ? (
                    <>
                      <span className="text-lg font-bold">
                        ₹{profitInfo.profit}
                      </span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({profitInfo.profitPercent}%)
                      </span>
                      {sellUnit.toLowerCase() !== costUnit.toLowerCase() && (
                        <div className="text-xs text-muted-foreground">
                          per {profitInfo.sellUnit}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      N/A (different units)
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Notes Section */}
          {notes && (
            <>
              <Separator />
              <div className="pt-2">
                <h4 className="font-semibold mb-1">Notes:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {notes || "No additional notes provided."}
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
