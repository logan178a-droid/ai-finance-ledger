"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { ProfileTab, type SettingsUser } from "./ProfileTab";
import { AppearanceTab } from "./AppearanceTab";
import { CategoriesTab, type CategoryRow } from "./CategoriesTab";
import { ExportTab } from "./ExportTab";
import { LinkedCardsTab, type LinkedAccountRow } from "./LinkedCardsTab";
import { FaqTab } from "./FaqTab";

const TABS = [
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
  const [tab, setTab] = useState("profile");

  return (
    <div className="space-y-5">
      <Tabs items={TABS} value={tab} onChange={setTab} />

      {tab === "profile" && <ProfileTab user={initialUser} />}
      {tab === "appearance" && <AppearanceTab initialTheme={initialUser.theme} />}
      {tab === "categories" && <CategoriesTab initialCategories={initialCategories} />}
      {tab === "linked" && <LinkedCardsTab initialRows={initialLinkedRows} />}
      {tab === "export" && <ExportTab userEmail={initialUser.email} />}
      {tab === "faq" && <FaqTab />}
    </div>
  );
}
