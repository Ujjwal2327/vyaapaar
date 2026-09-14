"use client";

/**
 * components/analytics/ProfitMarginChart.jsx
 *
 * See the header comment on computeProfitMarginTrend in analyticsUtils.js
 * for exactly what "margin" means here: realised sale price vs current
 * catalog cost, for items that have a cost price on file.
 */

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useChartColors } from "./chartTheme";
import { fmtCurrency } from "@/lib/utils/analyticsUtils";

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-sm">
      <p className="font-medium mb-1">{label}</p>
      <p>Margin: {d.marginPct === null ? "—" : `${d.marginPct.toFixed(1)}%`}</p>
      <p className="text-muted-foreground">
        Costed revenue: {fmtCurrency(d.revenue)}
      </p>
      <p className="text-muted-foreground">Est. COGS: {fmtCurrency(d.cogs)}</p>
    </div>
  );
};

export const ProfitMarginChart = ({ data, hasAnyCostData }) => {
  const colors = useChartColors();

  if (!hasAnyCostData) {
    return (
      <div className="bg-card rounded-xl border p-4">
        <h2 className="font-semibold text-base mb-1">Profit margin</h2>
        <p className="text-sm text-muted-foreground py-6 text-center">
          Add a cost price to items in your catalog (Catalog → Edit item) to see
          profit margin here.
        </p>
      </div>
    );
  }

  const totalUncosted = data.reduce((s, d) => s + d.uncostedRevenue, 0);

  return (
    <div className="bg-card rounded-xl border p-4">
      <h2 className="font-semibold text-base mb-1">Profit margin</h2>
      <p className="text-sm text-muted-foreground mb-3">
        Sale price vs current cost price, for items that have a cost price set.
        {totalUncosted > 0.01 && (
          <>
            {" "}
            {fmtCurrency(totalUncosted)} of sales had no cost price on file and
            are excluded.
          </>
        )}
      </p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: colors.axis }}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis
              tick={{ fontSize: 11, fill: colors.axis }}
              tickFormatter={(v) => `${v}%`}
              width={40}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="marginPct"
              name="Margin %"
              stroke={colors.margin}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
