"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ArrowLeftRight, Plus, CreditCard, Settings as SettingsIcon } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
] as const;

const RIGHT_ITEMS = [
  { href: "/credit-cards", label: "Cards", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function isActive(pathname: string | null, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

/**
 * Floating glass pill bottom nav — mobile only (desktop keeps the sidebar in
 * AppShell). Exactly the 5 slots in the locked spec: Home, Transactions, a
 * raised center FAB for manual entry, Cards, Settings.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed left-4 right-4 z-40 flex items-center justify-between px-3"
      style={{
        bottom: 18,
        height: 62,
        borderRadius: 22,
        background: "var(--surface-nav)",
        border: "1px solid var(--border)",
        backdropFilter: "blur(var(--glass-blur-strong))",
        WebkitBackdropFilter: "blur(var(--glass-blur-strong))",
        boxShadow: "var(--shadow-strong)",
      }}
    >
      {ITEMS.map((item) => (
        <NavItem key={item.href} {...item} active={isActive(pathname, item.href)} />
      ))}

      <Link
        href="/add-transaction"
        aria-label="Add transaction manually"
        className="flex shrink-0 items-center justify-center transition-transform hover:-translate-y-0.5 active:scale-95"
        style={{
          width: 46,
          height: 46,
          borderRadius: 15,
          marginTop: -26,
          background: "linear-gradient(135deg, var(--accent), var(--ai))",
          boxShadow: "0 12px 28px -4px rgba(76,134,255,0.5)",
        }}
      >
        <Plus size={22} strokeWidth={2.4} color="#ffffff" />
      </Link>

      {RIGHT_ITEMS.map((item) => (
        <NavItem key={item.href} {...item} active={isActive(pathname, item.href)} />
      ))}
    </nav>
  );
}

function NavItem({ href, icon: Icon, label, active }: { href: string; icon: typeof Home; label: string; active: boolean }) {
  return (
    <Link href={href} aria-label={label} className="flex flex-col items-center justify-center gap-1 px-2 py-1.5">
      <Icon size={20} strokeWidth={2.1} color={active ? "var(--accent)" : "var(--muted)"} />
      <span
        className="h-1 w-1 rounded-full transition-opacity"
        style={{ background: "var(--accent)", opacity: active ? 1 : 0 }}
      />
    </Link>
  );
}
