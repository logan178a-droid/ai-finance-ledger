"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/Tabs";
import { ProfileTab, type SettingsUser } from "./ProfileTab";
import { AppearanceTab } from "./AppearanceTab";
import { CategoriesTab, type CategoryRow } from "./CategoriesTab";
import { ExportTab } from "./ExportTab";
import { LinkedCardsTab, type LinkedAccountRow } from "./LinkedCardsTab";
import { ShareSetupTab } from "./ShareSetupTab";
import { FaqTab } from "./FaqTab";

// Share-to-app first — it's the app's primary, most "automatic-feeling"
// capture method (see the Home screen status indicator), so its setup tab
// leads rather than sitting alongside the others unordered.
const TABS = [
  { id: "share-setup", label: "Share-to-app" },
  { id: "profile", label: "Profile" },
  { id: "appearance", label: "Appearance" },
  { id: "categories", label: "Categories" },
  { id: "linked", label: "Cards & Accounts" },
  { id: "export", label: "Export" },
  { id: "faq", label: "FAQ / Help" },
];

export function SettingsView({
  initialUser,
  initialCategories,
  initialLinkedRows,
}: {
  initialUser: SettingsUser;
  initialCategories: CategoryRow[];
  initialLinkedRows: LinkedAccountRow[];
}) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState(TABS.some((t) => t.id === requestedTab) ? requestedTab! : "profile");

  return (
    <div className="space-y-5">
      <Tabs items={TABS} value={tab} onChange={setTab} />

      {tab === "share-setup" && <ShareSetupTab />}
      {tab === "profile" && <ProfileTab user={initialUser} />}
      {tab === "appearance" && <AppearanceTab initialTheme={initialUser.theme} />}
      {tab === "categories" && <CategoriesTab initialCategories={initialCategories} />}
      {tab === "linked" && <LinkedCardsTab initialRows={initialLinkedRows} />}
      {tab === "export" && <ExportTab userEmail={initialUser.email} />}
      {tab === "faq" && <FaqTab />}
    </div>
  );
}
