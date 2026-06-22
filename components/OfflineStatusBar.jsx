"use client";

/**
 * components/OfflineStatusBar.jsx  (v2)
 *
 * Changes vs v1:
 *  1. Fully responsive — wraps cleanly on narrow screens, text truncates
 *     gracefully, icon always visible.
 *  2. Pills are now tighter on mobile (icon + short count) and expand on sm+.
 *  3. Conflict pill is a real <button> with accessible focus ring.
 *  4. Syncing and pending states are combined into one pill when both are true.
 */

import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSyncContext } from "@/hooks/useSyncManager";
import { WifiOff, RefreshCw, AlertTriangle } from "lucide-react";

export default function OfflineStatusBar({ onOpenConflicts }) {
  const { isOnline } = useOnlineStatus();
  const { pendingCount, isSyncing, conflicts } = useSyncContext();
  const hasConflicts = conflicts.length > 0;

  // Nothing to show when everything is clean
  if (isOnline && !isSyncing && !hasConflicts && pendingCount === 0)
    return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
      {/* ── Offline ── */}
      {!isOnline && (
        <span
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
          bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200
          border border-amber-300 dark:border-amber-700 whitespace-nowrap"
        >
          <WifiOff className="w-3 h-3 shrink-0" />
          <span className="hidden xs:inline">Offline</span>
          {pendingCount > 0 && (
            <span className="font-bold">
              <span className="hidden sm:inline">· </span>
              {pendingCount}
              <span className="hidden sm:inline"> pending</span>
            </span>
          )}
        </span>
      )}

      {/* ── Online but has queued ops not yet synced ── */}
      {isOnline && !isSyncing && pendingCount > 0 && !hasConflicts && (
        <span
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
          bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200
          border border-blue-300 dark:border-blue-700 whitespace-nowrap"
        >
          <RefreshCw className="w-3 h-3 shrink-0" />
          <span>
            {pendingCount}
            <span className="hidden sm:inline"> to sync</span>
          </span>
        </span>
      )}

      {/* ── Syncing in progress ── */}
      {isSyncing && (
        <span
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
          bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200
          border border-blue-300 dark:border-blue-700 whitespace-nowrap"
        >
          <RefreshCw className="w-3 h-3 shrink-0 animate-spin" />
          <span className="hidden sm:inline">Syncing…</span>
        </span>
      )}

      {/* ── Conflicts need review ── */}
      {hasConflicts && (
        <button
          type="button"
          onClick={onOpenConflicts}
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
            bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200
            border border-red-300 dark:border-red-700
            hover:bg-red-200 dark:hover:bg-red-800/60
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400
            transition-colors whitespace-nowrap"
        >
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>
            {conflicts.length}
            <span className="hidden sm:inline">
              {" "}
              conflict{conflicts.length !== 1 ? "s" : ""}
            </span>
          </span>
          <span className="hidden sm:inline">— review</span>
        </button>
      )}
    </div>
  );
}
