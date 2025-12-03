"use client";

import React, { useState, useEffect } from "react";
import { Settings, Sun, Moon, Monitor, Search } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  UNIT_CATEGORIES,
  DEFAULT_ACTIVE_UNITS,
  unitMatchesQuery,
} from "@/lib/units-config";
import { supabase } from "@/lib/supabase";

const SettingsModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeUnits, setActiveUnits] = useState(DEFAULT_ACTIVE_UNITS);
  const [isSaving, setIsSaving] = useState(false);
  const { theme, setTheme } = useTheme();
  const { signOut, user } = useAuth();
  const router = useRouter();

  // Load settings from localStorage and DB on mount
  useEffect(() => {
    const loadSettings = async () => {
      // Font size
      const savedFontSize = localStorage.getItem("fontSize") || "100";
      setFontSize(parseInt(savedFontSize));
      document.documentElement.style.fontSize = `${savedFontSize}%`;

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
            localStorage.setItem(
              "activeUnits",
              JSON.stringify(data.active_units)
            );
          } else {
            // Fallback to localStorage
            const localUnits = localStorage.getItem("activeUnits");
            if (localUnits) {
              setActiveUnits(JSON.parse(localUnits));
            }
          }
        } catch (error) {
          console.error("Error loading active units:", error);
          const localUnits = localStorage.getItem("activeUnits");
          if (localUnits) {
            setActiveUnits(JSON.parse(localUnits));
          }
        }
      }
    };

    loadSettings();
  }, [user]);

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
      // Dialog is closing - save to DB
      await saveUnitsToDb();
    }
    setIsOpen(open);
  };

  const resetSettings = () => {
    setTheme("system");
    setFontSize(100);
    setActiveUnits(DEFAULT_ACTIVE_UNITS);
    localStorage.setItem("fontSize", "100");
    localStorage.setItem("activeUnits", JSON.stringify(DEFAULT_ACTIVE_UNITS));
    document.documentElement.style.fontSize = "100%";
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
        unitMatchesQuery(unit, searchQuery)
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

      <DialogContent className="sm:max-w-md max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize your application appearance and preferences.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Theme Toggle */}
            <div className="space-y-2">
              <Label className="text-[1.05rem]">Theme</Label>
              <Button
                onClick={() => {
                  theme === "light" ? setTheme("dark") : setTheme("light");
                }}
                className="w-full"
              >
                {theme === "light" ? (
                  <span className="flex gap-2 items-center">
                    <Sun className="h-5 w-5" />
                    <span>Light Theme</span>
                  </span>
                ) : theme === "dark" ? (
                  <span className="flex gap-2 items-center">
                    <Moon className="h-5 w-5" />
                    <span>Dark Theme</span>
                  </span>
                ) : (
                  <span className="flex gap-2 items-center">
                    <Monitor className="h-5 w-5" />
                    <span>System Theme</span>
                  </span>
                )}
              </Button>
            </div>

            <Separator />

            {/* Font Size Slider */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-[1.05rem]">Font Size</Label>
                <span className="text-sm text-muted-foreground">
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

              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-center font-medium">Preview Text</p>
                <p className="text-center text-sm text-muted-foreground mt-1">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
            </div>

            <Separator />

            {/* Active Units */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-[1.05rem]">Active Units</Label>
                <span className="text-sm text-muted-foreground">
                  {activeUnits.length} selected
                </span>
              </div>

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
              <div className="space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4 pt-0">
                {Object.keys(filteredCategories).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No units found
                  </p>
                ) : (
                  Object.entries(filteredCategories).map(
                    ([category, units]) => (
                      <div key={category} className="space-y-3">
                        <h4 className="font-semibold text-sm sticky top-0 bg-background py-1">
                          {category}
                        </h4>
                        <div className="space-y-2">
                          {units.map((unit) => (
                            <div
                              key={unit.name}
                              className="flex items-start space-x-2 p-2 rounded hover:bg-muted/50 transition-colors"
                            >
                              <Checkbox
                                id={unit.name}
                                checked={activeUnits.includes(unit.name)}
                                onCheckedChange={() => toggleUnit(unit.name)}
                                className="mt-0.5"
                              />
                              <label
                                htmlFor={unit.name}
                                className="text-sm font-medium cursor-pointer capitalize flex-1"
                              >
                                {unit.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )
                )}
              </div>
            </div>

            <Separator />

            {/* Reset Button (Moved here, separated from units section by a Separator) */}
            <Button
              onClick={resetSettings}
              variant="secondary"
              className="w-full"
            >
              Reset to Defaults
            </Button>

            {/* Added a custom margin-top for clear separation before the Logout button */}
            <div className="pt-4">
              <Separator />
            </div>

            {/* Logout Button - Now visually separated from Reset */}
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
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <p className="text-sm">Saving...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
