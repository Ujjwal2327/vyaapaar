"use client";

/**
 * components/settings/SettingsContainer.jsx
 *
 * Full-page settings, organized into tabs instead of the old modal's
 * accordions. Same max width and header shell as every other page (see
 * components/PageHeader.jsx) so Settings feels like part of the same app
 * rather than a wider, separate screen bolted on the side.
 *
 * Uses its own usePeople()/usePriceList() instances, same as every other
 * page in this app (there's no shared Context for either). Navigating
 * here unmounts whichever page you came from, and navigating back
 * remounts it fresh, so there's no risk of that page showing stale data
 * after an edit made here.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePeople } from "@/hooks/usePeople";
import { usePriceList } from "@/hooks/usePriceList";
import { SettingsHeader } from "./SettingsHeader";
import { SettingsNav, SETTINGS_TABS } from "./SettingsNav";
import { ProfileSection } from "./sections/ProfileSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { CatalogSection } from "./sections/CatalogSection";
import { ContactsSection } from "./sections/ContactsSection";
import Loader from "@/components/Loader";

const TAB_STORAGE_KEY = "settingsActiveTab";
const VALID_TABS = SETTINGS_TABS.map((t) => t.id);

export const SettingsContainer = () => {
  const router = useRouter();
  const { signOut } = useAuth();

  const [activeTab, setActiveTab] = useState("profile");

  // Remember the last tab visited, same "read localStorage once on mount"
  // shape sortType/activeUnits/granularity already use elsewhere in this
  // app, rather than putting it in the URL.
  useEffect(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    if (saved && VALID_TABS.includes(saved)) setActiveTab(saved);
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  };

  const {
    peopleData,
    categories,
    saveCategories,
    savePeopleData,
    isHydrated: peopleHydrated,
    isDataLoading: peopleLoading,
  } = usePeople();

  const {
    priceData,
    isHydrated: priceHydrated,
    isDataLoading: priceLoading,
  } = usePriceList();

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  if (!peopleHydrated || peopleLoading || !priceHydrated || priceLoading) {
    return <Loader content="Loading settings..." />;
  }

  const activeLabel = SETTINGS_TABS.find((t) => t.id === activeTab)?.label;

  return (
    <>
      <SettingsHeader />

      <div className="max-w-4xl mx-auto p-2 sm:p-4 pb-10">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
          <SettingsNav
            active={activeTab}
            onChange={handleTabChange}
            onLogout={handleLogout}
          />

          <div className="flex-1 min-w-0 space-y-4">
            <h2 className="hidden sm:block text-lg font-semibold tracking-tight">
              {activeLabel}
            </h2>
            {activeTab === "profile" && <ProfileSection />}
            {activeTab === "appearance" && <AppearanceSection />}
            {activeTab === "catalog" && (
              <CatalogSection priceData={priceData} />
            )}
            {activeTab === "contacts" && (
              <ContactsSection
                peopleData={peopleData}
                categories={categories}
                saveCategories={saveCategories}
                savePeopleData={savePeopleData}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};
