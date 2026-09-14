"use client";

/**
 * components/analytics/TopItemsPanel.jsx
 *
 * Top-selling items by revenue or quantity (see computeTopItems in
 * analyticsUtils.js), toggled with the same tab-pill styling as the
 * "Add items" / "Cart" tabs in AddTransactionModal's item panel.
 */

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useChartColors } from "./chartTheme";
import { fmtCurrency, fmtCompactCurrency } from "@/lib/utils/analyticsUtils";

const ChartTooltip = ({ active, payload, mode }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-sm max-w-[220px]">
      <p className="font-medium">{d.name}</p>
      {d.categoryPath && (
        <p className="text-muted-foreground text-xs mb-1">{d.categoryPath}</p>
      )}
      <p>
        {mode === "revenue"
          ? fmtCurrency(d.revenue)
          : `${d.quantity}${d.unit ? ` ${d.unit}` : ""}`}
      </p>
    </div>
  );
};

const truncate = (name) => (name.length > 16 ? `${name.slice(0, 15)}…` : name);

export const TopItemsPanel = ({ topItems }) => {
  const [mode, setMode] = useState("revenue");
  const colors = useChartColors();
  const list = mode === "revenue" ? topItems.byRevenue : topItems.byQuantity;

  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="font-semibold text-base">Top-selling items</h2>
        <div className="flex gap-1 p-1 rounded-lg bg-muted shrink-0">
          {[
            { id: "revenue", label: "By revenue" },
            { id: "quantity", label: "By quantity" },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`h-8 px-3 rounded-md text-sm font-medium transition-all ${
                mode === id
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No sales with catalog items yet
        </p>
      ) : (
        <div style={{ height: Math.max(180, list.length * 38) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={list}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={colors.grid}
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: colors.axis }}
                tickFormatter={(v) =>
                  mode === "revenue" ? fmtCompactCurrency(v) : v
                }
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: colors.axis }}
                tickFormatter={truncate}
                width={100}
              />
              <Tooltip content={<ChartTooltip mode={mode} />} />
              <Bar
                dataKey={mode === "revenue" ? "revenue" : "quantity"}
                fill={colors.bar}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
