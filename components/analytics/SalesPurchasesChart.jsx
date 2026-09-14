"use client";

/**
 * components/analytics/SalesPurchasesChart.jsx
 *
 * Sales vs purchases over time, bucketed by whatever granularity the page
 * header is set to (see bucketSalesAndPurchases in analyticsUtils.js).
 */

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useChartColors } from "./chartTheme";
import { fmtCurrency, fmtCompactCurrency } from "@/lib/utils/analyticsUtils";

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {fmtCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

export const SalesPurchasesChart = ({ data }) => {
  const colors = useChartColors();
  const totalSales = data.reduce((s, d) => s + d.sales, 0);
  const totalPurchases = data.reduce((s, d) => s + d.purchases, 0);

  return (
    <div className="bg-card rounded-xl border p-4">
      <h2 className="font-semibold text-base mb-1">Sales vs purchases</h2>
      <div className="flex gap-4 text-sm text-muted-foreground mb-3">
        <span>
          Sales{" "}
          <span className="font-semibold text-foreground">
            {fmtCurrency(totalSales)}
          </span>
        </span>
        <span>
          Purchases{" "}
          <span className="font-semibold text-foreground">
            {fmtCurrency(totalPurchases)}
          </span>
        </span>
      </div>
      <div className="h-64">
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
              tickFormatter={fmtCompactCurrency}
              width={48}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="sales"
              name="Sales"
              stroke={colors.sale}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="purchases"
              name="Purchases"
              stroke={colors.purchase}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
