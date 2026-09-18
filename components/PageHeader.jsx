"use client";

/**
 * components/PageHeader.jsx
 *
 * Shared sticky header shell for every top-level page (Catalog, Contacts,
 * Reports, Settings). Each page still owns its own controls — search
 * boxes, filters, toggles, titles — this only owns the outer shell:
 * sticky positioning, max width, the Logo+Navigation row, and the
 * divider before whatever page-specific row comes next. Previously each
 * page hand-rolled this shell separately, and it had quietly drifted out
 * of sync (Settings alone was a different max-width than everywhere
 * else). Routing every page through one component means that can't
 * happen again.
 *
 * `actions` renders on the right of the top row, next to Logo+Navigation
 * — typically SettingsButton plus whatever page-specific buttons belong
 * up there (Bulk Edit, Edit/Done, ...). `children` is the page-specific
 * row underneath, separated by a single divider; a page can put as many
 * of its own stacked rows in there as it needs.
 */

import Logo from "@/components/Logo";
import Navigation from "@/components/Navigation";

export default function PageHeader({ actions, children }) {
  return (
    <div className="sticky top-0 z-40 bg-background border-b">
      <div className="max-w-4xl mx-auto p-2">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-4 min-w-0">
            <Logo titleClassName="hidden sm:inline" />
            <Navigation />
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>

        {children && <div className="border-t pt-2.5">{children}</div>}
      </div>
    </div>
  );
}
