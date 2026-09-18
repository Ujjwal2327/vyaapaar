"use client";

/**
 * components/settings/sections/ProfileSection.jsx
 *
 * Thin wrapper around the two components that already did all the real
 * work — UserProfile and ShareBusinessLink — now each in its own titled
 * card (see components/settings/SettingsUI.jsx) so they read as two
 * distinct, related settings instead of one long unbroken form.
 */

import { User, Share2 } from "lucide-react";
import UserProfile from "@/components/UserProfile";
import ShareBusinessLink from "@/components/ShareBusinessLink";
import { SettingsSectionCard } from "@/components/settings/SettingsUI";

export const ProfileSection = () => {
  return (
    <div className="space-y-4">
      <SettingsSectionCard
        icon={User}
        title="Your profile"
        description="Your display name, business details, and UPI ID for payments."
      >
        <UserProfile />
      </SettingsSectionCard>

      <SettingsSectionCard
        icon={Share2}
        title="Share your business"
        description="A public link customers can use to browse your catalog — no login needed."
      >
        <ShareBusinessLink />
      </SettingsSectionCard>
    </div>
  );
};
