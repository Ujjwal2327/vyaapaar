"use client";

/**
 * components/analytics/AnalyticsContainer.jsx
 */

import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsHeader } from "./AnalyticsHeader";
import { SummaryCards } from "./SummaryCards";
import { SalesPurchasesChart } from "./SalesPurchasesChart";
import { TopItemsPanel } from "./TopItemsPanel";
import { ProfitMarginChart } from "./ProfitMarginChart";
import { ReceivablePayableChart } from "./ReceivablePayableChart";
import Loader from "@/components/Loader";

export const AnalyticsContainer = () => {
  const analytics = useAnalytics();

  if (!analytics.isHydrated || analytics.isDataLoading) {
    return <Loader content="Loading your reports..." />;
  }

  return (
    <>
      <AnalyticsHeader
        granularity={analytics.granularity}
        setGranularity={analytics.setGranularity}
        lastSyncedAt={analytics.lastSyncedAt}
      />

      <div className="max-w-4xl mx-auto p-2 space-y-4">
        {analytics.transactionCount === 0 ? (
          <div className="bg-card rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">
              No transactions yet — add a sale or purchase to see reports here.
            </p>
          </div>
        ) : (
          <>
            <SummaryCards summary={analytics.currentSummary} />
            <SalesPurchasesChart data={analytics.salesPurchases} />
            <TopItemsPanel topItems={analytics.topItems} />
            <ProfitMarginChart
              data={analytics.profitMarginTrend}
              hasAnyCostData={analytics.hasAnyCostData}
            />
            <ReceivablePayableChart data={analytics.receivablePayableTrend} />
          </>
        )}
      </div>
    </>
  );
};
