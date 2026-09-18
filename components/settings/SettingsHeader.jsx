"use client";

/**
 * components/settings/SettingsHeader.jsx
 *
 * Same sticky shell every other page uses (see components/PageHeader.jsx)
 * — a back button, a small icon badge, and a title stand in for the
 * search/filter controls those pages have instead. Previously this page
 * built its own one-off shell at max-w-5xl, wider than every other page
 * in the app; it now shares the exact same component and width as
 * Catalog, Contacts, and Reports.
 */

import { useRouter } from "next/navigation";
import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";

export const SettingsHeader = () => {
  const router = useRouter();

  return (
    <PageHeader>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <SettingsIcon className="w-4 h-4 text-primary" />
        </div>

        <div className="min-w-0">
          <h1 className="font-semibold text-base truncate">Settings</h1>
          <p className="text-sm text-muted-foreground truncate">
            Profile, catalog, contacts, and preferences
          </p>
        </div>
      </div>
    </PageHeader>
  );
};
