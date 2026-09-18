/**
 * lib/utils/contactNetAmount.js
 *
 * Pure helper for a contact's cached "net amount" — the exact same
 * receivable-minus-payable figure already shown live on a contact's own
 * transactions page (see TransactionSummary.jsx / useTransactions.js's
 * own `summary`), just persisted on the contact row itself
 * (contacts.net_amount) so the Contacts page can filter and sort by
 * balance without summing every contact's transactions on every page
 * load.
 *
 * Kept in sync by the app whenever a contact's transactions change — see
 * hooks/useTransactions.js (recomputeContactNetAmounts, and the local
 * optimistic helpers next to it) and hooks/useSyncManager.js (offline
 * queue replay + conflict resolution).
 *
 * Reuses the exact same per-transaction categorisation the analytics
 * page's receivable/payable trend already uses (see categorizeBalance in
 * analyticsUtils.js), so a contact's cached net amount, the Contacts
 * page's filter/sort, and the numbers you'd get by manually re-summing
 * their transactions can never quietly disagree on what "receivable" vs
 * "payable" means.
 */

import { categorizeBalance } from "@/lib/utils/analyticsUtils";

/**
 * transactions: array of { totalAmount, paidAmount, type, status? }.
 * Deleted transactions (status === "deleted") are skipped, same as every
 * other balance/summary calculation in this app. A transaction with no
 * `status` field at all (e.g. a DB row selected with `.neq("status",
 * "deleted")`, which already excludes deleted ones) is treated as
 * active — pass `status` when your caller hasn't already filtered
 * deleted rows out itself.
 */
export const computeContactNetAmount = (transactions) => {
  let toReceive = 0;
  let toGive = 0;

  for (const tx of transactions ?? []) {
    if (!tx || tx.status === "deleted") continue;
    const { toReceive: r, toGive: g } = categorizeBalance(
      tx.totalAmount,
      tx.paidAmount,
      tx.type,
    );
    toReceive += r;
    toGive += g;
  }

  return toReceive - toGive;
};
