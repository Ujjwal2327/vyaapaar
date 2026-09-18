"use client";

/**
 * components/settings/SettingsNav.jsx
 *
 * Section switcher for the settings page. A horizontal scrollable pill
 * row on mobile, a card-contained vertical sidebar on sm+ screens — the
 * same responsive shape the tab pills elsewhere in the app already use
 * (see AnalyticsHeader's granularity toggle, TopItemsPanel's
 * revenue/quantity toggle), just laid out as a sidebar where there's
 * room for one. The desktop list now sits inside its own card (matching
 * every settings section below it) instead of floating directly on the
 * page background, so the two-column layout reads as one intentional
 * shape rather than a list of buttons next to a stack of cards.
 *
 * "Sign out" is pinned separately from the section list, outside the
 * card — it's a destructive action, not a place to land, so it isn't
 * one of the tabs and shouldn't sit close enough to invite a mis-tap.
 */

import { User, Palette, Package, Users, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export const SETTINGS_TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "catalog", label: "Catalog", icon: Package },
  { id: "contacts", label: "Contacts", icon: Users },
];

export const SettingsNav = ({ active, onChange, onLogout }) => {
  return (
    <nav className="sm:w-52 shrink-0 space-y-3">
      {/* Mobile: horizontal scrollable pills */}
      <div className="flex sm:hidden gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {SETTINGS_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors",
              active === id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="sm:hidden w-full flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg text-sm font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>

      {/* Desktop: vertical sidebar, contained in a card */}
      <div className="hidden sm:block sticky top-24 space-y-3">
        <div className="bg-card rounded-xl border p-1.5 space-y-0.5">
          {SETTINGS_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "w-full flex items-center gap-2.5 h-10 px-3 rounded-lg text-sm font-medium text-left transition-colors",
                active === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 h-10 px-3 rounded-lg text-sm font-medium text-left text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </nav>
  );
};
