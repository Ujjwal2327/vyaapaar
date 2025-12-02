"use client";

import React, { useState, useEffect } from "react";
import { Settings, Sun, Moon, Monitor } from "lucide-react";
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
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Separator } from "@/components/ui/separator";

const SettingsModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();
  const router = useRouter();

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedFontSize = localStorage.getItem("fontSize") || "100";
    setFontSize(parseInt(savedFontSize));

    // Apply font size
    document.documentElement.style.fontSize = `${savedFontSize}%`;
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

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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

        <div className="space-y-6 py-4 flex flex-col">
          {/* Theme Toggle */}
          <Button
            onClick={() => {
              theme === "light" ? setTheme("dark") : setTheme("light");
            }}
            className="mx-auto"
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

          {/* Font Size Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Font Size</Label>
              <span className="text-sm text-muted-foreground">{fontSize}%</span>
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

            {/* Preview */}
            <div className="mt-4 rounded-lg border bg-muted/50 p-4">
              <p className="text-center font-medium">Preview Text</p>
              <p className="text-center text-sm text-muted-foreground mt-1">
                The quick brown fox jumps over the lazy dog
              </p>
            </div>
          </div>

          {/* Reset Button */}
          <Button
            onClick={resetSettings}
            variant="secondary"
            className="w-full"
          >
            Reset to Defaults
          </Button>

          <Separator />

          {/* Logout Button */}
          <Button
            onClick={handleLogout}
            variant="destructive"
            className="w-full"
          >
            Logout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
