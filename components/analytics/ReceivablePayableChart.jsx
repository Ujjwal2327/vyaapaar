"use client";

/**
 * components/analytics/ReceivablePayableChart.jsx
 *
 * Unlike the SummaryCards above it (today's snapshot), this is a genuine
 * historical trend — see computeReceivablePayableTrend in
 * analyticsUtils.js for how "outstanding balance as of a past date" is
 * reconstructed from each transaction's payment history.
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

export const ReceivablePayableChart = ({ data }) => {
  const colors = useChartColors();

  return (
    <div className="bg-card rounded-xl border p-4">
      <h2 className="font-semibold text-base mb-1">Receivable vs payable</h2>
      <p className="text-sm text-muted-foreground mb-3">
        Outstanding balance as of the end of each period.
      </p>
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
              dataKey="toReceive"
              name="Receivable"
              stroke={colors.receivable}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="toGive"
              name="Payable"
              stroke={colors.payable}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="net"
              name="Net"
              stroke={colors.net}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
