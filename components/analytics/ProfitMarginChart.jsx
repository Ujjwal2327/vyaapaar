"use client";

/**
 * components/analytics/ProfitMarginChart.jsx
 *
 * See the header comment on computeProfitMarginTrend in analyticsUtils.js
 * for exactly what "margin" means here: realised sale price vs the cost
 * recorded on each sale line when it was saved. Sales that predate recorded
 * costs fall back to the item's current catalog cost; the periods they touch
 * are estimates, drawn with hollow markers and explained in the tooltip and
 * in the key under the chart.
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

// What "estimated" means, in words. Shared by the tooltip (one period) and
// the key under the chart (the whole range).
const estimatedNote = (amount) =>
  amount > 0.01
    ? `includes ${fmtCurrency(amount)} of sales costed at the current cost price`
    : "includes sales costed at the current cost price";

/**
 * Marker for one period on the margin line.
 *
 * Periods that rest on recorded costs get no marker, so the line looks as it
 * always did. Estimated periods get a hollow ring: hollow reads as "not
 * firm" without needing a second colour. The marker that follows the pointer
 * is solid for recorded periods and stays hollow for estimated ones, so
 * hovering never changes what a period says about itself.
 *
 * The 2px stroke is the series-coloured rim of a hollow marker, or the
 * card-coloured ring around a solid one. Either way the visible mark is at
 * least 8px across.
 *
 * recharts clones this element for every point and merges its own props over
 * ours, so the colours go in under names it never sets.
 */
export const MarginDot = ({
  cx,
  cy,
  payload,
  active = false,
  markColor,
  surfaceColor,
}) => {
  if (cx == null || cy == null) return null; // a period with no margin
  const estimated = Boolean(payload?.estimated);
  if (!estimated && !active) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={active ? 5 : 4}
      strokeWidth={2}
      fill={estimated ? surfaceColor : markColor}
      stroke={estimated ? markColor : surfaceColor}
    />
  );
};

export const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="max-w-xs rounded-lg border bg-popover px-3 py-2 shadow-md text-sm">
      <p className="font-medium mb-1">{label}</p>
      <p>Margin: {d.marginPct === null ? "—" : `${d.marginPct.toFixed(1)}%`}</p>
      <p className="text-muted-foreground">
        Costed revenue: {fmtCurrency(d.revenue)}
      </p>
      <p className="text-muted-foreground">COGS: {fmtCurrency(d.cogs)}</p>
      {d.estimated && (
        <p className="text-muted-foreground mt-1">
          Estimated: {estimatedNote(d.estimatedRevenue)}
        </p>
      )}
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
  // Only periods that actually get a marker count towards the key.
  const estimatedPeriods = data.filter(
    (d) => d.estimated && d.marginPct !== null,
  );
  const totalEstimated = estimatedPeriods.reduce(
    (s, d) => s + d.estimatedRevenue,
    0,
  );

  return (
    <div className="bg-card rounded-xl border p-4">
      <h2 className="font-semibold text-base mb-1">Profit margin</h2>
      <p className="text-sm text-muted-foreground mb-3">
        Sale price vs the cost price recorded when each item was sold. Older
        sales with no recorded cost use the current cost price instead, and are
        marked as estimated.
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
              dot={
                <MarginDot
                  markColor={colors.margin}
                  surfaceColor={colors.surface}
                />
              }
              activeDot={
                <MarginDot
                  active
                  markColor={colors.margin}
                  surfaceColor={colors.surface}
                />
              }
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {estimatedPeriods.length > 0 && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2"
            style={{
              borderColor: colors.margin,
              backgroundColor: colors.surface,
            }}
          />
          <span>Estimated: {estimatedNote(totalEstimated)}</span>
        </p>
      )}
    </div>
  );
};
