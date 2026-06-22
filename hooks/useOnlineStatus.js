"use client";

/**
 * useOnlineStatus.js
 *
 * Returns { isOnline: boolean }.
 * Updates synchronously whenever the network status changes.
 *
 * Also provides a one-shot promise `waitForOnline()` that resolves
 * as soon as the device comes back online (used by useSyncManager).
 */

import { useState, useEffect } from "react";

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline };
};

/**
 * Resolves the next time the window fires "online".
 * If already online, resolves immediately.
 */
export const waitForOnline = () => {
  if (typeof navigator !== "undefined" && navigator.onLine) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const handler = () => {
      window.removeEventListener("online", handler);
      resolve();
    };
    window.addEventListener("online", handler);
  });
};
