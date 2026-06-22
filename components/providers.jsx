"use client";

/**
 * components/providers.jsx  — updated to include SyncProvider
 *
 * Drop-in replacement for the original.  The only change is wrapping
 * children with <SyncProvider> (inside AuthProvider so useSyncManager
 * can call useAuth()).
 */

import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { AuthProvider } from "./auth/AuthProvider";
import { SyncProvider } from "./SyncProvider";

export function Providers({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        {/* SyncProvider must be inside AuthProvider so it can read useAuth() */}
        <SyncProvider>{children}</SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
