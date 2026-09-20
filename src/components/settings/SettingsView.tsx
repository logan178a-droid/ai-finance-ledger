"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { User, Palette, Tag, Landmark, Radio, Download, HelpCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/ui/afl/GlassCard";
import { MonoLabel } from "@/components/ui/afl/MonoLabel";
import { ProfileTab, type SettingsUser } from "./ProfileTab";
import { AppearanceTab } from "./AppearanceTab";
import { CategoriesTab, type CategoryRow } from "./CategoriesTab";
import { ExportTab } from "./ExportTab";
import { LinkedCardsTab, type LinkedAccountRow } from "./LinkedCardsTab";
import { ShareSetupTab } from "./ShareSetupTab";
import { FaqTab } from "./FaqTab";

interface SettingsSection {
  id: string;
  label: string;
  icon: typeof User;
  color: string;
  group: "Account" | "Cards & Accounts" | "Share-to-app" | "About";
}

// Share-to-app first — it's the app's primary, most "automatic-feeling"
// capture method (see the Home screen status indicator).
const SECTIONS: SettingsSection[] = [
  { id: "share-setup", label: "Share-to-app", icon: Radio, color: "#34D6A6", group: "Share-to-app" },
  { id: "linked", label: "Cards & Accounts", icon: Landmark, color: "#4C86FF", group: "Cards & Accounts" },
  { id: "profile", label: "Profile", icon: User, color: "#9C8CFF", group: "Account" },
  { id: "appearance", label: "Appearance", icon: Palette, color: "#F0A83C", group: "Account" },
  { id: "categories", label: "Categories", icon: Tag, color: "#5FE7C3", group: "Account" },
  { id: "export", label: "Export", icon: Download, color: "#4C86FF", group: "Account" },
  { id: "faq", label: "FAQ / Help", icon: HelpCircle, color: "#7C89B8", group: "About" },
];

const GROUP_ORDER: SettingsSection["group"][] = ["Share-to-app", "Cards & Accounts", "Account", "About"];

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
  const [tab, setTab] = useState<string | null>(SECTIONS.some((s) => s.id === requestedTab) ? requestedTab : null);

  if (tab) {
    const section = SECTIONS.find((s) => s.id === tab)!;
    return (
      <div className="space-y-5">
        <button onClick={() => setTab(null)} className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
          <ChevronLeft size={16} /> Settings
        </button>
        <h1 className="text-xl font-semibold tracking-tight">{section.label}</h1>

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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      {GROUP_ORDER.map((group) => {
        const rows = SECTIONS.filter((s) => s.group === group);
        return (
          <div key={group} className="space-y-2">
            <MonoLabel className="px-1">{group}</MonoLabel>
            <GlassCard radius={20} padding="4px 4px">
              {rows.map((section, i) => (
                <button
                  key={section.id}
                  onClick={() => setTab(section.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-background/40 transition-colors"
                  style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : undefined, borderRadius: 16 }}
                >
                  <span
                    className="flex shrink-0 items-center justify-center"
                    style={{ width: 34, height: 34, borderRadius: 11, background: `color-mix(in srgb, ${section.color} 12%, transparent)` }}
                  >
                    <section.icon size={16} color={section.color} strokeWidth={2} />
                  </span>
                  <span className="flex-1 text-sm font-medium">{section.label}</span>
                  <ChevronRight size={16} color="var(--muted)" strokeWidth={2} />
                </button>
              ))}
            </GlassCard>
          </div>
        );
      })}
    </div>
  );
}
