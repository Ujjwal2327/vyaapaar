"use client";

/**
 * components/providers.jsx
 *
 * Renders children unconditionally — including during the server render.
 *
 * This used to gate everything behind a `mounted` flag ("return null
 * until the first client effect has run"), a common but unnecessary
 * guard against next-themes hydration warnings. The trouble is that it
 * didn't just skip one render — it meant NOTHING under <Providers> (i.e.
 * every page in the app) was ever present in the server-rendered HTML. A
 * link-preview crawler, a search engine that doesn't run JS, or just a
 * slow connection all saw a completely empty <body>, no matter how
 * complete that page's own <head> metadata was.
 *
 * next-themes' own docs point at the actual fix: put
 * suppressHydrationWarning on <html> (and, since the theme class also
 * lands on <body>, on <body> too) — see app/layout.tsx, where both are
 * already set. That's the one thing the removed `mounted` check was
 * protecting against, so there's nothing left to gate on.
 */

import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./auth/AuthProvider";
import { SyncProvider } from "./SyncProvider";

export function Providers({ children }) {
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
