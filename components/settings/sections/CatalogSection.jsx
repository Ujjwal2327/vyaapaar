"use client";

/**
 * components/settings/sections/CatalogSection.jsx
 *
 * Everything the old modal only showed while you happened to be on
 * /catalog: item/category stats, the Show Cost/Profit toggle, Active
 * Units, and Stock Alerts. All four now live here regardless of which
 * page you came from, since a dedicated settings page has no "current
 * page" to key off of.
 *
 * Active Units switches from "save on dialog close" (there's no close
 * event on a page) to an explicit Save button with the same
 * change-detection shape EditItemModal/UserProfile already use elsewhere
 * in this app, rather than auto-saving on every checkbox click.
 */

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Package,
  FolderTree,
  AlertTriangle,
  Percent,
  Ruler,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import {
  UNIT_CATEGORIES,
  DEFAULT_ACTIVE_UNITS,
  unitMatchesQuery,
} from "@/lib/units-config";
import { countItemsAndCategories } from "@/lib/utils/priceListStats";
import { findLowStockItems } from "@/lib/utils/stockUtils";
import { toast } from "sonner";
import {
  SettingsSectionCard,
  SettingsStatCard,
} from "@/components/settings/SettingsUI";

export const CatalogSection = ({ priceData }) => {
  const { user } = useAuth();

  const [showCostProfit, setShowCostProfit] = useState(false);

  const [activeUnits, setActiveUnits] = useState(DEFAULT_ACTIVE_UNITS);
  const [initialActiveUnits, setInitialActiveUnits] =
    useState(DEFAULT_ACTIVE_UNITS);
  const [isSavingUnits, setIsSavingUnits] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { itemCount: totalItems, categoryCount: totalCategories } = useMemo(
    () => countItemsAndCategories(priceData),
    [priceData],
  );
  const lowStockItems = useMemo(
    () => findLowStockItems(priceData),
    [priceData],
  );

  useEffect(() => {
    setShowCostProfit(localStorage.getItem("showCostProfit") === "true");

    let units = DEFAULT_ACTIVE_UNITS;
    const local = localStorage.getItem("activeUnits");
    if (local) {
      try {
        units = JSON.parse(local);
      } catch {
        units = DEFAULT_ACTIVE_UNITS;
      }
    }
    setActiveUnits(units);
    setInitialActiveUnits(units);

    if (!user?.id) return;

    (async () => {
      const { data, error } = await supabase
        .from("price_lists")
        .select("active_units")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data?.active_units) {
        setActiveUnits(data.active_units);
        setInitialActiveUnits(data.active_units);
        localStorage.setItem("activeUnits", JSON.stringify(data.active_units));
      }
    })();
  }, [user]);

  const toggleShowCostProfit = (checked) => {
    setShowCostProfit(checked);
    localStorage.setItem("showCostProfit", checked.toString());
  };

  const toggleUnit = (unitName) => {
    setActiveUnits((prev) =>
      prev.includes(unitName)
        ? prev.filter((u) => u !== unitName)
        : [...prev, unitName],
    );
  };

  // Sorted comparison so re-toggling a unit off then back on (which
  // appends it at the end rather than restoring its original position)
  // doesn't read as "changed" when the actual selected set is identical.
  const unitsChanged =
    JSON.stringify([...activeUnits].sort()) !==
    JSON.stringify([...initialActiveUnits].sort());

  const handleSaveUnits = async () => {
    if (!user?.id || !unitsChanged || isSavingUnits) return;
    setIsSavingUnits(true);
    try {
      const { error } = await supabase
        .from("price_lists")
        .update({ active_units: activeUnits })
        .eq("user_id", user.id);
      if (error) throw error;

      localStorage.setItem("activeUnits", JSON.stringify(activeUnits));
      setInitialActiveUnits(activeUnits);
      toast.success("Units updated");
    } catch (err) {
      console.error("Error saving active units:", err);
      toast.error("Failed to save units");
    } finally {
      setIsSavingUnits(false);
    }
  };

  const filteredUnitCategories = useMemo(() => {
    if (!searchQuery.trim()) return UNIT_CATEGORIES;
    const filtered = {};
    Object.entries(UNIT_CATEGORIES).forEach(([category, units]) => {
      const matched = units.filter((unit) =>
        unitMatchesQuery(unit, searchQuery),
      );
      if (matched.length > 0) filtered[category] = matched;
    });
    return filtered;
  }, [searchQuery]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <SettingsStatCard
          icon={Package}
          label="Total Items"
          value={totalItems}
        />
        <SettingsStatCard
          icon={FolderTree}
          label="Categories"
          value={totalCategories}
        />
      </div>

      {/* Cost/Profit toggle */}
      <SettingsSectionCard
        icon={Percent}
        title="Show Cost Prices & Profits"
        description="Enable cycling between Sell, Cost, and Profit views in the catalog"
        action={
          <Switch
            checked={showCostProfit}
            onCheckedChange={toggleShowCostProfit}
          />
        }
      />

      {/* Active Units */}
      <SettingsSectionCard
        icon={Ruler}
        title="Active Units"
        description="Which units show up when adding or editing an item"
        action={
          <Badge variant="secondary">{activeUnits.length} selected</Badge>
        }
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search units (e.g., 'kg', 'meter', 'ft')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto no-scrollbar border rounded-lg p-3 pt-0">
            {Object.keys(filteredUnitCategories).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No units found
              </p>
            ) : (
              Object.entries(filteredUnitCategories).map(
                ([category, units]) => (
                  <div key={category} className="space-y-2">
                    <h4 className="font-semibold text-sm uppercase text-muted-foreground sticky top-0 bg-card py-2">
                      {category}
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-1">
                      {units.map((unit) => (
                        <div
                          key={unit.name}
                          className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            id={`unit-${unit.name}`}
                            checked={activeUnits.includes(unit.name)}
                            onCheckedChange={() => toggleUnit(unit.name)}
                          />
                          <label
                            htmlFor={`unit-${unit.name}`}
                            className="text-sm cursor-pointer capitalize flex-1"
                          >
                            {unit.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              )
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t">
            <p className="text-sm text-muted-foreground">
              {unitsChanged ? "You have unsaved changes" : "Up to date"}
            </p>
            <Button
              onClick={handleSaveUnits}
              disabled={!unitsChanged || isSavingUnits}
              size="sm"
            >
              {isSavingUnits ? "Saving..." : "Save Units"}
            </Button>
          </div>
        </div>
      </SettingsSectionCard>

      {/* Stock Alerts */}
      <SettingsSectionCard
        icon={AlertTriangle}
        title="Stock Alerts"
        description="Items at or below their low-stock threshold"
        action={
          lowStockItems.length > 0 && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 border-0">
              {lowStockItems.length} low
            </Badge>
          )
        }
      >
        {lowStockItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No low-stock alerts right now. Turn on stock tracking for an item
            from its Edit screen to start seeing alerts here once it runs low.
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {lowStockItems.map((item) => (
              <div
                key={item.path}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${
                  item.status === "out"
                    ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
                    : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 ${
                      item.status === "out" ? "text-red-500" : "text-amber-500"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.categoryPath && (
                      <p className="text-sm text-muted-foreground truncate">
                        {item.categoryPath}
                      </p>
                    )}
                  </div>
                </div>
                <Badge
                  className={`shrink-0 border-0 ${
                    item.status === "out"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"
                  }`}
                >
                  {item.status === "out"
                    ? "Out of stock"
                    : `${item.stockQty} left`}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </SettingsSectionCard>
    </div>
  );
};
