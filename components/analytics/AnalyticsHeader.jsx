"use client";

/**
 * components/analytics/AnalyticsHeader.jsx  (v2)
 *
 * v2: the GSTR-1 trigger is now the shadcn <Button> (it was a hand-styled
 * <button>), so it follows the same sizing/focus/dark-mode rules as every other
 * button in the app.
 *
 * Same shell every page uses (see components/PageHeader.jsx), with a
 * day/week/month toggle in place of a search box, plus a quiet note when
 * the numbers being shown are from the last successful sync rather than
 * live.
 */

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import SettingsButton from "@/components/SettingsButton";
import { Gstr1ExportDialog } from "@/components/gst/Gstr1ExportDialog";
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
  showGstr1 = false, // true only once a GST invoice exists
}) => {
  const { isOnline } = useOnlineStatus();
  const [gstr1Open, setGstr1Open] = useState(false);

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

        <div className="flex items-center gap-2 shrink-0">
          {/* GSTR-1 export: absent until the first GST invoice has been issued */}
          {showGstr1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 gap-1.5"
              onClick={() => setGstr1Open(true)}
            >
              <FileSpreadsheet className="w-4 h-4" />
              GSTR-1
            </Button>
          )}
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
      {showGstr1 && (
        <Gstr1ExportDialog open={gstr1Open} onOpenChange={setGstr1Open} />
      )}
    </PageHeader>
  );
};
