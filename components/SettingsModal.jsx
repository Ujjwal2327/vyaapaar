// components/SettingsModalUpdated.jsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  Search,
  ChevronDown,
  Package,
  FolderTree,
  Boxes,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  UNIT_CATEGORIES,
  DEFAULT_ACTIVE_UNITS,
  unitMatchesQuery,
} from "@/lib/units-config";
import { supabase } from "@/lib/supabase";
import UserProfile from "@/components/UserProfile";
import ShareBusinessLink from "@/components/ShareBusinessLink";
import { countItemsAndCategories } from "@/lib/utils/priceListStats";
import Accordion from "@/components/ui/accordion";

const SettingsModal = ({ sellPriceMode, toggleSellPriceMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeUnits, setActiveUnits] = useState(DEFAULT_ACTIVE_UNITS);
  const [initialActiveUnits, setInitialActiveUnits] =
    useState(DEFAULT_ACTIVE_UNITS);
  const [showCostProfit, setShowCostProfit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [totalCategories, setTotalCategories] = useState(0);
  const { theme, setTheme } = useTheme();
  const { signOut, user } = useAuth();
  const router = useRouter();

  // Load item count from database
  const loadItemCount = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("price_lists")
        .select("data")
        .eq("user_id", user.id)
        .single();

      if (!error && data?.data) {
        const { itemCount, categoryCount } = countItemsAndCategories(data.data);
        setTotalItems(itemCount);
        setTotalCategories(categoryCount);
      }
    } catch (error) {
      console.error("Error loading item count:", error);
    }
  };

  // Load settings from localStorage and DB on mount
  useEffect(() => {
    const loadSettings = async () => {
      // Font size
      const savedFontSize = localStorage.getItem("fontSize") || "100";
      setFontSize(parseInt(savedFontSize));
      document.documentElement.style.fontSize = `${savedFontSize}%`;

      // Show Cost/Profit setting
      const savedShowCostProfit = localStorage.getItem("showCostProfit");
      setShowCostProfit(savedShowCostProfit === "true");

      // Active units - prioritize DB over localStorage
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from("price_lists")
            .select("active_units")
            .eq("user_id", user.id)
            .single();

          if (!error && data?.active_units) {
            setActiveUnits(data.active_units);
            setInitialActiveUnits(data.active_units);
            localStorage.setItem(
              "activeUnits",
              JSON.stringify(data.active_units),
            );
          } else {
            // Fallback to localStorage
            const localUnits = localStorage.getItem("activeUnits");
            if (localUnits) {
              const parsedUnits = JSON.parse(localUnits);
              setActiveUnits(parsedUnits);
              setInitialActiveUnits(parsedUnits);
            } else {
              setInitialActiveUnits(DEFAULT_ACTIVE_UNITS);
            }
          }
        } catch (error) {
          console.error("Error loading active units:", error);
          const localUnits = localStorage.getItem("activeUnits");
          if (localUnits) {
            const parsedUnits = JSON.parse(localUnits);
            setActiveUnits(parsedUnits);
            setInitialActiveUnits(parsedUnits);
          } else {
            setInitialActiveUnits(DEFAULT_ACTIVE_UNITS);
          }
        }
      } else {
        const localUnits = localStorage.getItem("activeUnits");
        if (localUnits) {
          const parsedUnits = JSON.parse(localUnits);
          setInitialActiveUnits(parsedUnits);
        }
      }

      // Load item count
      await loadItemCount();
    };

    if (isOpen) {
      loadSettings();
    }
  }, [user, isOpen]);

  const handleFontSizeChange = (value) => {
    const newSize = value[0];
    setFontSize(newSize);
    localStorage.setItem("fontSize", newSize.toString());
    document.documentElement.style.fontSize = `${newSize}%`;
  };

  const toggleUnit = (unitName) => {
    setActiveUnits((prev) => {
      const newUnits = prev.includes(unitName)
        ? prev.filter((u) => u !== unitName)
        : [...prev, unitName];

      // Save to localStorage immediately
      localStorage.setItem("activeUnits", JSON.stringify(newUnits));
      return newUnits;
    });
  };

  const saveUnitsToDb = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("price_lists")
        .update({ active_units: activeUnits })
        .eq("user_id", user.id);

      if (error) throw error;
    } catch (error) {
      console.error("Error saving active units:", error);
      alert("Failed to save units to database");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDialog = async (open) => {
    if (!open && isOpen) {
      // Dialog is closing - only save to DB if activeUnits changed
      const unitsChanged =
        JSON.stringify(activeUnits) !== JSON.stringify(initialActiveUnits);
      if (unitsChanged) {
        await saveUnitsToDb();
      }
    }
    setIsOpen(open);
  };

  const resetSettings = () => {
    setTheme("system");
    setFontSize(100);
    localStorage.setItem("fontSize", "100");
    document.documentElement.style.fontSize = "100%";
    setShowCostProfit(false);
    localStorage.setItem("showCostProfit", "false");
  };

  const toggleShowCostProfit = (checked) => {
    setShowCostProfit(checked);
    localStorage.setItem("showCostProfit", checked.toString());
  };

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
    setIsOpen(false);
  };

  // Filter units based on search query
  const getFilteredCategories = () => {
    if (!searchQuery.trim()) return UNIT_CATEGORIES;

    const filtered = {};

    Object.entries(UNIT_CATEGORIES).forEach(([category, units]) => {
      const matchedUnits = units.filter((unit) =>
        unitMatchesQuery(unit, searchQuery),
      );
      if (matchedUnits.length > 0) {
        filtered[category] = matchedUnits;
      }
    });

    return filtered;
  };

  const filteredCategories = getFilteredCategories();

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl">Settings</DialogTitle>
          <DialogDescription>
            Customize your application and manage your profile
          </DialogDescription>
        </DialogHeader>

        {/* Inventory Stats */}
        <div className="grid grid-cols-2 gap-3 pb-2">
          <div className="flex items-center gap-3 p-3 bg-linear-to-br from-primary/10 to-primary/5 rounded-lg border">
            <Package className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalItems}</p>
              <p className="text-sm text-muted-foreground">Total Items</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-linear-to-br from-secondary/10 to-secondary/5 rounded-lg border">
            <FolderTree className="w-8 h-8 text-secondary-foreground" />
            <div>
              <p className="text-2xl font-bold">{totalCategories}</p>
              <p className="text-sm text-muted-foreground">Categories</p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 max-h-[calc(90vh-200px)]">
          <div className="space-y-3">
            {/* User Profile Accordion */}
            <Accordion title="User Profile" defaultOpen={false}>
              <UserProfile />
            </Accordion>

            {/* Share Business Link Accordion */}
            <Accordion title="Share Your Business" defaultOpen={false}>
              <ShareBusinessLink />
            </Accordion>

            {/* Display Settings Accordion */}
            <Accordion title="Display Settings">
              <div className="space-y-5">
                {/* Theme Toggle */}
                <div className="space-y-2">
                  <Label className="text-[16px]">Theme</Label>
                  <Button
                    onClick={() => {
                      theme === "light" ? setTheme("dark") : setTheme("light");
                    }}
                    className="w-full"
                    variant="outline"
                  >
                    {theme === "light" ? (
                      <span className="flex gap-2 items-center">
                        <Sun className="h-4 w-4" />
                        <span>Light Theme</span>
                      </span>
                    ) : theme === "dark" ? (
                      <span className="flex gap-2 items-center">
                        <Moon className="h-4 w-4" />
                        <span>Dark Theme</span>
                      </span>
                    ) : (
                      <span className="flex gap-2 items-center">
                        <Monitor className="h-4 w-4" />
                        <span>System Theme</span>
                      </span>
                    )}
                  </Button>
                </div>

                {/* Font Size Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[16px]">Font Size</Label>
                    <span className="text-xs text-muted-foreground">
                      {fontSize}%
                    </span>
                  </div>

                  <Slider
                    value={[fontSize]}
                    onValueChange={handleFontSizeChange}
                    min={75}
                    max={150}
                    step={5}
                    className="w-full"
                  />

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Small</span>
                    <span>Large</span>
                  </div>

                  <div className="rounded-lg border bg-muted/50 p-3">
                    <p className="text-center font-medium text-sm">
                      Preview Text
                    </p>
                    <p className="text-center text-xs text-muted-foreground mt-1">
                      The quick brown fox jumps over the lazy dog
                    </p>
                  </div>
                </div>

                {/* Show Cost/Profit Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-[16px]">
                      Show Cost Prices & Profits
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Enable cycling between Sell, Cost, and Profit views
                    </p>
                  </div>
                  <Switch
                    checked={showCostProfit}
                    onCheckedChange={toggleShowCostProfit}
                  />
                </div>

                <Button
                  onClick={resetSettings}
                  variant="secondary"
                  className="w-full mt-2"
                  size="sm"
                >
                  Reset Display Settings
                </Button>
              </div>
            </Accordion>

            {/* Active Units Accordion */}
            <Accordion
              title="Active Units"
              badge={`${activeUnits.length} selected`}
            >
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search units (e.g., 'kg', 'meter', 'ft')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Units by Category */}
              <div className="space-y-4 max-h-80 overflow-y-auto no-scrollbar border rounded-lg p-3 pt-0">
                {Object.keys(filteredCategories).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No units found
                  </p>
                ) : (
                  Object.entries(filteredCategories).map(
                    ([category, units]) => (
                      <div key={category} className="space-y-2">
                        <h4 className="font-semibold text-sm uppercase text-muted-foreground sticky top-0 bg-background py-2">
                          {category}
                        </h4>
                        <div className="space-y-1">
                          {units.map((unit) => (
                            <div
                              key={unit.name}
                              className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 transition-colors"
                            >
                              <Checkbox
                                id={unit.name}
                                checked={activeUnits.includes(unit.name)}
                                onCheckedChange={() => toggleUnit(unit.name)}
                              />
                              <label
                                htmlFor={unit.name}
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
            </Accordion>

            <Separator className="my-4" />

            {/* Logout Button */}
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="w-full"
            >
              Logout
            </Button>
          </div>
        </ScrollArea>

        {isSaving && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
            <div className="bg-card p-4 rounded-lg shadow-lg border">
              <p className="text-sm font-medium">Saving changes...</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;