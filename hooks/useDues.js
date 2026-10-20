"use client";

/**
 * hooks/useDues.js
 *
 * Fresh-from-the-server outstanding balances per contact, for the WhatsApp
 * reminders. Deliberately NOT offline-first like usePeople/useTransactions:
 * the whole reminders feature is disabled offline, and a reminder that
 * quotes a stale amount is worse than no reminder. So every time a
 * reminder dialog opens it reads the transactions table again, rather than
 * trusting a localStorage cache or contacts.net_amount.
 *
 * Only rows that can still have a balance are fetched (status pending or
 * overpaid — "complete" rows are exactly settled), and only the columns the
 * maths needs. Linked ("also involves") contacts aren't counted: contact_id
 * is the one financially responsible, same as everywhere else.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { groupDuesByContact } from "@/lib/utils/duesUtils";

const PAGE_SIZE = 1000; // PostgREST's default response cap

const LIGHT_COLUMNS =
  "id, contact_id, type, total_amount, paid_amount, created_at";
const DETAIL_COLUMNS = `${LIGHT_COLUMNS}, kind, note, items_list`;

const rowToDueRow = (row) => ({
  id: row.id,
  contactId: row.contact_id,
  type: row.type,
  kind: row.kind,
  note: row.note ?? "",
  itemsList: row.items_list ?? [],
  totalAmount: Number(row.total_amount) || 0,
  paidAmount: Number(row.paid_amount) || 0,
  createdAt: row.created_at,
});

/**
 * @param {string} userId
 * @param {object} [opts]
 * @param {string|null} [opts.contactId]   one contact, or every contact with a contact_id
 * @param {boolean} [opts.withDetails]     also fetch items/note (statement PDF)
 */
export const fetchDueRows = async (
  userId,
  { contactId = null, withDetails = false } = {},
) => {
  const rows = [];
  let from = 0;

  for (;;) {
    let query = supabase
      .from("transactions")
      .select(withDetails ? DETAIL_COLUMNS : LIGHT_COLUMNS)
      .eq("user_id", userId)
      .in("status", ["pending", "overpaid"]);

    query = contactId
      ? query.eq("contact_id", contactId)
      : query.not("contact_id", "is", null);

    // Secondary order on id so rows sharing a timestamp can't be skipped or
    // repeated across page boundaries.
    const { data, error } = await query
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows.map(rowToDueRow);
};

/**
 * @param {object} p
 * @param {boolean} p.enabled     fetch whenever this turns true (dialog open AND online)
 * @param {string|null} [p.contactId]
 *
 * Returns { dues: Map<contactId, dues>, isLoading, hasLoaded, error, refresh, reset }.
 * `hasLoaded` stays true across a background refresh, so UI built on it
 * doesn't flash a spinner (and lose half-typed edits) when the connection
 * blips. Call reset() when the dialog closes so the next open starts clean.
 */
export const useDues = ({ enabled, contactId = null }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [dues, setDues] = useState(() => new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!userId) return;
    const ticket = ++requestRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const rows = await fetchDueRows(userId, { contactId });
      if (ticket !== requestRef.current) return;
      setDues(groupDuesByContact(rows));
      setHasLoaded(true);
    } catch (err) {
      if (ticket !== requestRef.current) return;
      console.warn("[useDues] fetch failed:", err?.message);
      setError(err);
    } finally {
      if (ticket === requestRef.current) setIsLoading(false);
    }
  }, [userId, contactId]);

  const reset = useCallback(() => {
    requestRef.current += 1; // drop any in-flight response
    setDues(new Map());
    setHasLoaded(false);
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  return { dues, isLoading, hasLoaded, error, refresh: load, reset };
};
