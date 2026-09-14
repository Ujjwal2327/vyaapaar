"use client";

/**
 * components/Navigation.jsx  (v3)
 *
 * Changes vs v2:
 *  1. Added a "Reports" nav item pointing at /analytics.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Users, Receipt, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import OfflineStatusBar from "@/components/OfflineStatusBar";
import ConflictReviewModal from "@/components/ConflictReviewModal";

export default function Navigation() {
  const pathname = usePathname();
  const [showConflicts, setShowConflicts] = useState(false);

  const navItems = [
    { href: "/catalog", label: "Catalog", icon: Package },
    { href: "/contacts", label: "Contacts", icon: Users },
    { href: "/unassigned", label: "Unassigned", icon: Receipt },
    { href: "/analytics", label: "Reports", icon: BarChart3 },
  ];

  return (
    <>
      {/* Outer wrapper: row on sm+, wraps on xs */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
        {/* Nav buttons */}
        <nav className="flex gap-1.5 shrink-0">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className="gap-1.5 h-8 px-2.5"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline text-sm">{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Offline / syncing / conflict pill — only renders when needed */}
        <OfflineStatusBar onOpenConflicts={() => setShowConflicts(true)} />
      </div>

      {/* Conflict modal — single mount point for the whole app */}
      <ConflictReviewModal
        open={showConflicts}
        onOpenChange={setShowConflicts}
      />
    </>
  );
}
