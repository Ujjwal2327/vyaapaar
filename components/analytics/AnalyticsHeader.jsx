"use client";

/**
 * components/analytics/AnalyticsHeader.jsx
 *
 * Same sticky header shape as PriceListHeader/PeopleHeader (Logo + Nav +
 * Settings on top, a page-specific row underneath) with a day/week/month
 * toggle in place of a search box, plus a quiet note when the numbers
 * being shown are from the last successful sync rather than live.
 */

import Logo from "@/components/Logo";
import Navigation from "@/components/Navigation";
import SettingsModal from "@/components/SettingsModal";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { formatDistanceToNow } from "date-fns";

const GRANULARITIES = [
  { id: "day", label: "Daily" },
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
];

export const AnalyticsHeader = ({
  granularity,
  setGranularity,
  lastSyncedAt,
}) => {
  const { isOnline } = useOnlineStatus();

  return (
    <div className="sticky top-0 z-40 bg-background border-b">
      <div className="max-w-4xl mx-auto p-2">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-4">
            <Logo titleClassName="hidden sm:inline" />
            <Navigation />
          </div>
          <div className="flex items-center gap-2">
            <SettingsModal />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 py-2 border-t flex-wrap">
          <div className="min-w-0">
            <h1 className="font-semibold text-base">Reports</h1>
            {!isOnline && lastSyncedAt && (
              <p className="text-sm text-muted-foreground truncate">
                Offline — showing data from{" "}
                {formatDistanceToNow(new Date(lastSyncedAt), {
                  addSuffix: true,
                })}
              </p>
            )}
          </div>

          <div className="flex gap-1 p-1 rounded-lg bg-muted shrink-0">
            {GRANULARITIES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setGranularity(id)}
                className={`h-8 px-3 rounded-md text-sm font-medium transition-all ${
                  granularity === id
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
