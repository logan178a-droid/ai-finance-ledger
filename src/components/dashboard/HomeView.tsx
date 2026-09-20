"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Mic } from "lucide-react";
import { useStore } from "@/lib/store/StoreContext";
import { buildSnapshot, getAccountBalance, getBankAndCashBalance, getBankCashTrend, getRecentTransactions } from "@/lib/ledger/selectors";
import { groupByMonthAndDay } from "@/lib/ledger/activity";
import { formatINR, formatCompactAmount } from "@/lib/utils";
import { accountSwatch, CATEGORY_COLOR } from "@/lib/categoryColor";
import { CategoryIcon } from "@/components/shared/categoryIcon";
import { GlassCard } from "@/components/ui/afl/GlassCard";
import { MonoLabel, Mono } from "@/components/ui/afl/MonoLabel";
import { GlassPill, ColorSwatch } from "@/components/ui/afl/Pills";
import { ShareToAppStatus } from "@/components/dashboard/ShareToAppStatus";
import { VoiceCaptureSheet } from "@/components/assistant/VoiceCaptureSheet";
import { isAiSource } from "@/lib/types";

export function HomeView({ name, daysLeftLabel }: { name: string; daysLeftLabel: string }) {
  const { accounts, creditCards, transactions } = useStore();
  const [sheetOpen, setSheetOpen] = useState(false);

  const snap = useMemo(() => buildSnapshot(accounts, creditCards, transactions), [accounts, creditCards, transactions]);
  const { bank, cash } = getBankAndCashBalance(snap);
  const total = bank + cash;
  const trend = useMemo(() => getBankCashTrend(snap, 6), [snap]);
  const first = trend[0]?.value ?? total;
  const growthPct = first !== 0 ? ((total - first) / Math.abs(first)) * 100 : 0;

  const bankCashAccounts = accounts.filter((a) => a.type === "bank" || a.type === "cash");
  const recent = getRecentTransactions(transactions, 10);
  const grouped = useMemo(() => groupByMonthAndDay(recent), [recent]);

  const sparkPath = useMemo(() => buildSparkline(trend.map((p) => p.value)), [trend]);
  const initial = name.charAt(0).toUpperCase() || "?";

  return (
    <div className="h-full overflow-y-auto" style={{ padding: "22px 20px 100px", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* header */}
      <div className="flex items-center gap-3">
        <div
          className="flex shrink-0 items-center justify-center font-extrabold"
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            background: "linear-gradient(135deg,#1B2E63,#0A1128)",
            border: "1px solid rgba(255,255,255,0.10)",
            fontSize: 16,
            color: "#B49BFF",
          }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div style={{ fontSize: 16, fontWeight: 700 }}>Hi, {name}</div>
          <MonoLabel>{daysLeftLabel}</MonoLabel>
        </div>
        <button
          aria-label="Notifications"
          className="shrink-0 flex items-center justify-center"
          style={{ width: 38, height: 38, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Bell size={17} color="#B7BFE0" strokeWidth={2} />
        </button>
      </div>

      <ShareToAppStatus />

      {/* total balance hero */}
      <GlassCard radius={26} padding="22px 22px 24px" tone="hero">
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <MonoLabel>Total Balance</MonoLabel>
            {trend.length > 1 && (
              <div
                className="flex items-center gap-1"
                style={{ padding: "4px 9px", borderRadius: 999, background: "rgba(52,214,166,0.14)" }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34D6A6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d={growthPct >= 0 ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#34D6A6" }}>{Math.abs(growthPct).toFixed(1)}%</span>
              </div>
            )}
          </div>

          <div className="flex items-baseline gap-0.5">
            <span style={{ fontSize: 19, fontWeight: 700, color: "#B49BFF" }}>₹</span>
            <span
              className="money"
              style={{
                fontSize: 38,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                // A solid, guaranteed-visible color, not a
                // background-clip:text gradient — that trick renders fully
                // invisible text (transparent with no fallback) on any
                // browser/WebView that doesn't support clipping a
                // background to text, which is exactly what was reported.
                color: "#F4F7FF",
              }}
            >
              {new Intl.NumberFormat("en-IN").format(Math.round(total))}
            </span>
          </div>

          <svg width="100%" height="36" viewBox="0 0 300 36" preserveAspectRatio="none" style={{ display: "block" }}>
            <defs>
              <linearGradient id="afl-spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#4C86FF" stopOpacity="0.35" />
                <stop offset="1" stopColor="#4C86FF" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polyline points={sparkPath.line} fill="none" stroke="#7FA6FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <polygon points={sparkPath.fill} fill="url(#afl-spark-fill)" />
          </svg>

          {bankCashAccounts.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {bankCashAccounts.map((a) => {
                const bal = getAccountBalance(snap, a.id);
                return (
                  <GlassPill key={a.id}>
                    <ColorSwatch color={accountSwatch(a.name)} />
                    <Mono style={{ fontSize: 11, color: "#DCE4FF" }}>
                      {a.name.split(" ")[0]} · {formatCompactAmount(bal)}
                    </Mono>
                  </GlassPill>
                );
              })}
            </div>
          )}
        </div>
      </GlassCard>

      {/* voice capture CTA */}
      <div
        className="flex flex-col items-center gap-2.5"
        style={{ padding: "20px 16px 16px", borderRadius: 24, background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <button
          onClick={() => setSheetOpen(true)}
          aria-label="Speak a transaction"
          className="flex items-center justify-center transition-transform hover:-translate-y-0.5 active:scale-95"
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "radial-gradient(circle at 32% 28%, #6C9BFF, #4C86FF 46%, #3A6BE0 100%)",
            boxShadow: "0 16px 34px rgba(76,134,255,0.42), 0 0 0 8px rgba(76,134,255,0.08)",
          }}
        >
          <Mic size={26} color="#FFFFFF" strokeWidth={2.2} />
        </button>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Tap to speak a transaction</div>
        <Link href="/add-transaction" className="afl-mono" style={{ fontSize: 11, color: "#7C89B8", letterSpacing: "0.04em" }}>
          or add manually →
        </Link>
      </div>

      {/* recent activity */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div style={{ fontSize: 15, fontWeight: 700 }}>Recent Activity</div>
          <Link href="/transactions" className="afl-mono" style={{ fontSize: 11, color: "#7FA6FF" }}>
            See all
          </Link>
        </div>

        {grouped.length === 0 ? (
          <p className="text-sm text-muted py-6 text-center">
            No transactions yet — tap the mic above, or{" "}
            <Link href="/add-transaction" className="text-accent">
              add one manually
            </Link>
            .
          </p>
        ) : (
          grouped.map((month) =>
            month.days.map((day) => (
              <div key={day.dateKey} className="flex flex-col gap-2.5">
                <MonoLabel>{isToday(day.dateKey) ? "Today" : day.label}</MonoLabel>
                <div className="flex flex-col gap-1">
                  {day.transactions.map((t) => {
                    const isCredit = t.transaction_type === "income" || t.transaction_type === "refund";
                    const isNeutral = t.transaction_type === "transfer" || t.transaction_type === "credit_card_payment";
                    const accountLabel =
                      accounts.find((a) => a.id === t.account_id)?.name ?? creditCards.find((c) => c.id === t.credit_card_id)?.name;
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-3"
                        style={{ padding: "11px 12px", borderRadius: 16, background: "var(--surface)" }}
                      >
                        <CategoryTile category={t.category} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span style={{ fontSize: 13.5, fontWeight: 600 }} className="truncate">
                              {t.description}
                            </span>
                            {isAiSource(t.source) && <span style={{ fontSize: 10, color: "#B49BFF" }}>✦</span>}
                          </div>
                          <MonoLabel className="truncate">
                            {t.category}
                            {accountLabel ? ` · ${accountLabel}` : ""}
                          </MonoLabel>
                        </div>
                        <div
                          className="money shrink-0"
                          style={{ fontSize: 14, fontWeight: 700, color: isCredit ? "#5FE7C3" : isNeutral ? "var(--muted)" : "#EDF1FB" }}
                        >
                          {isCredit ? "+" : isNeutral ? "" : "-"}
                          {formatINR(t.amount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )
        )}
      </div>

      <VoiceCaptureSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}

function CategoryTile({ category }: { category: Parameters<typeof CategoryIcon>[0]["category"] }) {
  const color = CATEGORY_COLOR[category] ?? "#7C89B8";
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{ width: 34, height: 34, borderRadius: 11, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <CategoryIcon category={category} size={15} color={color} />
    </span>
  );
}

function isToday(dateKey: string): boolean {
  return dateKey === new Date().toISOString().slice(0, 10);
}

function buildSparkline(values: number[]): { line: string; fill: string } {
  if (values.length < 2) return { line: "0,18 300,18", fill: "0,18 300,18 300,36 0,36" };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 300;
  const h = 36;
  const step = w / (values.length - 1);
  const points = values.map((v, i) => {
    const x = Math.round(i * step);
    const y = Math.round(h - 4 - ((v - min) / range) * (h - 8));
    return `${x},${y}`;
  });
  return { line: points.join(" "), fill: `${points.join(" ")} ${w},${h} 0,${h}` };
}
