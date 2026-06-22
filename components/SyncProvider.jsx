"use client";

/**
 * SyncProvider.jsx
 *
 * Wrap this around your app (inside AuthProvider) to make sync state
 * available everywhere via useSyncContext().
 *
 * Place in components/providers.jsx, inside <AuthProvider>.
 */

import { SyncContext, useSyncManager } from "@/hooks/useSyncManager";

export function SyncProvider({ children }) {
  const sync = useSyncManager();
  return <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>;
}
