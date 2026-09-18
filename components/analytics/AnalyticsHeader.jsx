"use client";

/**
 * components/analytics/AnalyticsHeader.jsx
 *
 * Same shell every page uses (see components/PageHeader.jsx), with a
 * day/week/month toggle in place of a search box, plus a quiet note when
 * the numbers being shown are from the last successful sync rather than
 * live.
 */

import SettingsButton from "@/components/SettingsButton";
import PageHeader from "@/components/PageHeader";
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
    <PageHeader actions={<SettingsButton />}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
    </PageHeader>
  );
};
