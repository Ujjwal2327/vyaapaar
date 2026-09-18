"use client";

/**
 * components/SettingsButton.jsx
 *
 * Small icon-button used in every page header to open Settings. Settings
 * used to live in a Dialog (see the old SettingsModal.jsx) that grew to
 * seven accordions — profile, business link, display, active units,
 * stock alerts, contact categories, logout — which stopped being
 * comfortable inside a popup. It's a full page now, mounted at
 * /settings (see components/settings/SettingsContainer.jsx), so this
 * component is just the entry point to it.
 */

import Link from "next/link";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsButton() {
  return (
    <Button variant="ghost" size="icon" asChild>
      <Link href="/settings" aria-label="Settings">
        <Settings className="h-5 w-5" />
      </Link>
    </Button>
  );
}
