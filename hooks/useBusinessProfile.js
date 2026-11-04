"use client";

/**
 * hooks/useBusinessProfile.js
 *
 * Small, read-only, offline-first read of the current user's own business
 * profile (name / address / phone / email) — the same public.users columns
 * UserProfile.jsx and ShareBusinessLink.jsx already query directly.
 * useAuth() alone only ever gives you the Supabase Auth user (id, email as
 * far as auth is concerned) — the business fields live in the separate
 * public.users row keyed by that id, same as everywhere else in this app
 * that shows them. Pulled into one hook so anything that needs "who is
 * this shop" (right now: the transaction invoice PDF) doesn't have to
 * re-query Supabase and re-derive the shape by hand.
 *
 * Follows the same cache-then-fetch shape as usePeople / usePriceList:
 * serve whatever's cached in localStorage instantly, then refresh from the
 * server in the background. This is read-only, so — unlike those hooks —
 * there's no offline write queue involved.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

const LOCAL_KEY = "businessProfile";

const rowToProfile = (row, fallbackEmail) => ({
  businessName: row?.business_name || "",
  businessAddress: row?.business_address || "",
  phone: row?.phone || "",
  email: row?.email || fallbackEmail || "",
  upiId: row?.upi_id || "",
  gstEnabled: row?.gst_enabled === true,
  gstin: row?.gstin || "",
});

const PROFILE_COLUMNS =
  "business_name, business_address, phone, email, upi_id, gst_enabled, gstin";

// Same-tab broadcast (the native "storage" event never fires in the tab that
// made the change) so every mounted useBusinessProfile() instance — e.g. the
// Settings toggle and a transaction modal — sees a change straight away.
export const BUSINESS_PROFILE_UPDATED_EVENT = "businessProfileChanged";

/** Merge a change into the cached profile and tell mounted hooks about it. */
export const patchBusinessProfileCache = (patch) => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const next = { ...(raw ? JSON.parse(raw) : {}), ...patch };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(BUSINESS_PROFILE_UPDATED_EVENT));
  } catch {
    // best-effort cache, same as everywhere else in this app
  }
};

// Several components on one page can each mount this hook (the contacts page
// alone mounts a few reminder/transaction dialogs); share one in-flight read
// per user instead of every instance hitting the table.
const inflight = new Map();
const fetchProfileRow = (userId) => {
  if (!inflight.has(userId)) {
    const request = Promise.resolve(
      supabase.from("users").select(PROFILE_COLUMNS).eq("id", userId).single(),
    ).finally(() => inflight.delete(userId));
    inflight.set(userId, request);
  }
  return inflight.get(userId);
};

export const useBusinessProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasFetched = useRef(false);
  const prevUserIdRef = useRef(null);

  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const userChanged =
      hasFetched.current && currentUserId !== prevUserIdRef.current;
    if (userChanged) {
      // Different account signed in on this device — don't let the
      // previous shop's cached profile leak into the new session even
      // for a moment.
      hasFetched.current = false;
      setProfile(null);
    }
    prevUserIdRef.current = currentUserId;

    if (!userChanged) {
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (raw) setProfile(JSON.parse(raw));
      } catch {
        // ignore malformed cache
      }
    }

    if (!user) {
      setIsLoading(false);
      return;
    }
    if (hasFetched.current) {
      setIsLoading(false);
      return;
    }
    hasFetched.current = true;
    setIsLoading(true);

    (async () => {
      try {
        const { data, error } = await fetchProfileRow(user.id);
        if (error) throw error;
        const next = rowToProfile(data, user.email);
        setProfile(next);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      } catch (err) {
        console.warn(
          "[useBusinessProfile] fetch failed (offline?):",
          err.message,
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user]);

  // Pick up changes made elsewhere (Settings flipping the GST toggle, a bill
  // saving the shop's GSTIN) without waiting for a remount.
  useEffect(() => {
    const reread = () => {
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (raw) setProfile(JSON.parse(raw));
      } catch {
        // ignore malformed cache
      }
    };
    window.addEventListener(BUSINESS_PROFILE_UPDATED_EVENT, reread);
    window.addEventListener("storage", reread);
    return () => {
      window.removeEventListener(BUSINESS_PROFILE_UPDATED_EVENT, reread);
      window.removeEventListener("storage", reread);
    };
  }, []);

  // On-demand refresh — called right before generating a PDF so the
  // invoice reflects the latest saved profile even if this component
  // mounted before a Settings > User Profile edit landed. Swallows its own
  // errors and falls back to whatever's already in state/cache, since a
  // failed refresh here shouldn't block generating the PDF (offline use is
  // a real case for this app).
  const refresh = useCallback(async () => {
    if (!user) return profile;
    try {
      const { data, error } = await supabase
        .from("users")
        .select(PROFILE_COLUMNS)
        .eq("id", user.id)
        .single();
      if (error) throw error;
      const next = rowToProfile(data, user.email);
      setProfile(next);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      return next;
    } catch (err) {
      console.warn(
        "[useBusinessProfile] refresh failed (offline?):",
        err.message,
      );
      return profile;
    }
  }, [user, profile]);

  return { profile, isLoading, refresh };
};
