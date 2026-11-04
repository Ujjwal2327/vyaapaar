"use client";

/**
 * hooks/useGst.js
 *
 * The one place the rest of the app asks "is GST on, and what's the shop's
 * GSTIN?". Built on useBusinessProfile (offline-first: cached profile
 * instantly, fresh read in the background), so every component gets the same
 * answer and a change made in Settings shows up everywhere without a reload.
 *
 * `enabled` is false until the profile is known, so GST UI never flashes in
 * for an account that has it off.
 *
 * Writes (turning GST on/off, saving the GSTIN) go straight to the users row
 * like every other profile edit in this app — they need a connection, and
 * throw so the caller can toast.
 */

import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  useBusinessProfile,
  patchBusinessProfileCache,
} from "@/hooks/useBusinessProfile";
import { gstinProblem, gstinState, normalizeGstin } from "@/lib/utils/gstUtils";

export const useGst = () => {
  const { user } = useAuth();
  const { profile, isLoading, refresh } = useBusinessProfile();

  const enabled = profile?.gstEnabled === true;
  const gstin = profile?.gstin || "";

  const setEnabled = useCallback(
    async (value) => {
      if (!user) throw new Error("NOT_AUTHENTICATED");
      const { error } = await supabase
        .from("users")
        .update({ gst_enabled: !!value })
        .eq("id", user.id);
      if (error) throw error;
      patchBusinessProfileCache({ gstEnabled: !!value });
    },
    [user],
  );

  const saveGstin = useCallback(
    async (value) => {
      if (!user) throw new Error("NOT_AUTHENTICATED");
      const g = normalizeGstin(value);
      const problem = gstinProblem(g);
      if (problem || !g) throw new Error(problem || "Enter your GSTIN");
      const { error } = await supabase
        .from("users")
        .update({ gstin: g })
        .eq("id", user.id);
      if (error) throw error;
      patchBusinessProfileCache({ gstin: g });
      return g;
    },
    [user],
  );

  return {
    enabled,
    gstin,
    sellerStateCode: gstinState(gstin),
    isLoading,
    business: profile,
    refresh,
    setEnabled,
    saveGstin,
  };
};
