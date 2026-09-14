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
  },
};

export const useChartColors = () => {
  const { resolvedTheme } = useTheme();
  return useMemo(
    () => PALETTE[resolvedTheme === "dark" ? "dark" : "light"],
    [resolvedTheme],
  );
};
