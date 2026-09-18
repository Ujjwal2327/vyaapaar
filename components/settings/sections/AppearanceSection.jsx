"use client";

/**
 * components/settings/sections/AppearanceSection.jsx
 *
 * Theme + font size. The theme control is now a real three-way switch —
 * previously the only click target toggled directly between light and
 * dark, so "System" was rendered as a possible icon state but had no way
 * to actually be selected (only "Reset Display Settings" could get back
 * to it). All three options are now equally one tap away.
 */

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { SettingsSectionCard } from "@/components/settings/SettingsUI";

const THEME_OPTIONS = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

export const AppearanceSection = () => {
  const { theme, setTheme } = useTheme();
  const [fontSize, setFontSize] = useState(100);

  useEffect(() => {
    const saved = localStorage.getItem("fontSize") || "100";
    setFontSize(parseInt(saved));
  }, []);

  const handleFontSizeChange = (value) => {
    const newSize = value[0];
    setFontSize(newSize);
    localStorage.setItem("fontSize", newSize.toString());
    document.documentElement.style.fontSize = `${newSize}%`;
  };

  const resetSettings = () => {
    setTheme("system");
    setFontSize(100);
    localStorage.setItem("fontSize", "100");
    document.documentElement.style.fontSize = "100%";
  };

  return (
    <SettingsSectionCard
      icon={Palette}
      title="Appearance"
      description="Choose how Vyaapaar looks and reads on this device."
    >
      <div className="space-y-6">
        {/* Theme */}
        <div className="space-y-2">
          <Label className="text-base">Theme</Label>
          <div className="grid grid-cols-3 gap-2 max-w-sm">
            {THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border-2 py-3 text-sm font-medium transition-all ${
                  theme === id
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Font size */}
        <div className="space-y-3 max-w-sm">
          <div className="flex items-center justify-between">
            <Label className="text-base">Font Size</Label>
            <span className="text-sm text-muted-foreground tabular-nums">
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

          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Small</span>
            <span>Large</span>
          </div>

          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-center font-medium text-sm">Preview Text</p>
            <p className="text-center text-sm text-muted-foreground mt-1">
              The quick brown fox jumps over the lazy dog
            </p>
          </div>
        </div>

        <Button onClick={resetSettings} variant="secondary" size="sm">
          Reset Display Settings
        </Button>
      </div>
    </SettingsSectionCard>
  );
};
