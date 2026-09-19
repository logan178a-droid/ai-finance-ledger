"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutDashboard, ArrowLeftRight, Landmark, CreditCard, Settings as SettingsIcon, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/branding/LogoMark";

// Home (the AI capture surface) is the default landing page; the full
// overview lives one click away at /dashboard, no longer the first thing
// a user sees.
const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/credit-cards", label: "Credit Cards", icon: CreditCard },
];

// Pinned at the bottom of the sidebar, separate from the main nav list —
// standard convention (main nav on top, settings/profile at the bottom).
const SETTINGS_ITEM = { href: "/settings", label: "Settings", icon: SettingsIcon };

const SHELL_LESS_PATHS = ["/login", "/register"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname && SHELL_LESS_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar */}
      <aside className="glass-strong hidden md:flex md:w-64 md:flex-col border-r border-border bg-surface-raised px-4 py-6">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile top bar */}
      <div className="glass-strong md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-surface-raised border-b border-border">
        <div className="flex items-center gap-2 font-semibold">
          <LogoMark size={22} className="rounded-md" />
          AI Finance Ledger
        </div>
        <button
          aria-label="Toggle menu"
          className="p-2 rounded-md hover:bg-background"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {mobileOpen && (
        <div className="glass-strong md:hidden fixed top-[57px] left-0 right-0 z-20 bg-surface-raised border-b border-border px-4 py-4 max-h-[calc(100vh-57px)] overflow-y-auto">
          <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </div>
      )}

      <main className="flex-1 min-w-0 pt-[57px] md:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">{children}</div>
      </main>
    </div>
  );
}

function isActive(pathname: string | null, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

function NavLink({ href, label, icon: Icon, active, onNavigate }: { href: string; label: string; icon: typeof LayoutDashboard; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
        active
          ? "bg-accent-soft text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_28%,transparent)]"
          : "text-muted hover:bg-background/60 hover:text-foreground"
      )}
    >
      <Icon size={18} strokeWidth={2} />
      {label}
    </Link>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <>
      <div className="hidden md:flex items-center gap-2 px-2 mb-8 font-semibold text-lg">
        <LogoMark size={26} className="rounded-lg" />
        AI Finance Ledger
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="mt-auto pt-6 border-t border-border md:mt-auto">
        <NavLink {...SETTINGS_ITEM} active={isActive(pathname, SETTINGS_ITEM.href)} onNavigate={onNavigate} />
      </div>
    </>
  );
}
