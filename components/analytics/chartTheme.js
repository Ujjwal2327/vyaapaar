"use client";

/**
 * components/analytics/chartTheme.js
 *
 * recharts draws SVG, so its colors have to be literal, JS-readable values
 * rather than Tailwind classes — a className doesn't reach a
 * stroke/fill prop. This hook is the bridge: it watches the app's
 * resolved theme (next-themes, same as SettingsModal's theme toggle) and
 * returns a small palette that mirrors the semantic colors already used
 * everywhere else in the app for the same concepts — sales/receivables in
 * green, purchases/payables in red (see TransactionCard.jsx,
 * TransactionSummary.jsx) — rather than inventing a separate chart-only
 * color language.
 *
 * `surface` is the one entry that isn't a series colour: it's the card the
 * charts sit on (--card in app/globals.css). Markers use it for the ring that
 * keeps them legible where they sit on a line, and hollow markers use it as
 * their fill.
 */

import { useMemo } from "react";
import { useTheme } from "next-themes";

const PALETTE = {
  light: {
    grid: "#e5e7eb",
    axis: "#6b7280",
    sale: "#16a34a",
    purchase: "#dc2626",
    receivable: "#16a34a",
    payable: "#dc2626",
    net: "#4f46e5",
    margin: "#2563eb",
    bar: "#4f46e5",
    surface: "#ffffff",
  },
  dark: {
    grid: "#374151",
    axis: "#9ca3af",
    sale: "#4ade80",
    purchase: "#f87171",
    receivable: "#4ade80",
    payable: "#f87171",
    net: "#818cf8",
    margin: "#60a5fa",
    bar: "#818cf8",
    surface: "#171717", // oklch(0.205 0 0), the dark --card
  },
};

export const useChartColors = () => {
  const { resolvedTheme } = useTheme();
  return useMemo(
    () => PALETTE[resolvedTheme === "dark" ? "dark" : "light"],
    [resolvedTheme],
  );
};
