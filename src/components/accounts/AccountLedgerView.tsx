"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, Landmark } from "lucide-react";
import { isSameMonth, parseISO } from "date-fns";
import { useStore } from "@/lib/store/StoreContext";
import { buildSnapshot, getAccountBalance, getAccountLedgerRows } from "@/lib/ledger/selectors";
import { formatINR } from "@/lib/utils";
import { accountSwatch } from "@/lib/categoryColor";
import { GlassCard } from "@/components/ui/afl/GlassCard";
import { MonoLabel } from "@/components/ui/afl/MonoLabel";
import { ActivityRow } from "@/components/transactions/ActivityRow";
import { groupByMonthAndDay } from "@/lib/ledger/activity";

/**
 * The real per-account ledger: current balance, this-month income/expense
 * totals, and every transaction that touched this account with its running
 * balance shown — the "accounting-style" view the redesign spec calls for,
 * built on the same real selectors/components as the rest of the app.
 */
export function AccountLedgerView({ accountId }: { accountId: string }) {
  const { accounts, creditCards, transactions } = useStore();
  const account = accounts.find((a) => a.id === accountId);

  const snap = useMemo(() => buildSnapshot(accounts, creditCards, transactions), [accounts, creditCards, transactions]);
  const rows = useMemo(() => getAccountLedgerRows(snap, accountId), [snap, accountId]);
  const balance = account ? getAccountBalance(snap, accountId) : 0;

  const thisMonth = useMemo(() => {
    const now = new Date();
    let income = 0;
    let expense = 0;
    for (const r of rows) {
      if (!isSameMonth(parseISO(r.transaction.transaction_date), now)) continue;
      if (r.transaction.transaction_type === "income" || r.transaction.transaction_type === "refund") income += r.transaction.amount;
      if (r.transaction.transaction_type === "expense") expense += r.transaction.amount;
    }
    return { income, expense };
  }, [rows]);

  const grouped = useMemo(() => groupByMonthAndDay(rows.map((r) => r.transaction)), [rows]);
  const balanceById = useMemo(() => new Map(rows.map((r) => [r.transaction.id, r.balanceAfter])), [rows]);

  if (!account) return <p className="text-sm text-muted">Account not found.</p>;

  const swatch = accountSwatch(account.name);

  return (
    <div className="space-y-6">
      <Link href="/accounts" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
        <ChevronLeft size={16} /> Accounts
      </Link>

      <div className="flex items-center gap-3">
        <span className="flex shrink-0 items-center justify-center" style={{ width: 44, height: 44, borderRadius: 15, background: swatch }}>
          <Landmark size={20} color="#fff" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{account.name}</h1>
          <MonoLabel>{account.bank}</MonoLabel>
        </div>
      </div>

      <GlassCard radius={26} padding="22px" tone="hero">
        <MonoLabel>Current Balance</MonoLabel>
        <div
          className="money font-extrabold mt-1 mb-5"
          style={{
            fontSize: 34,
            letterSpacing: "-0.02em",
            background: "linear-gradient(135deg,#F4F7FF,#C9D4F5)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {formatINR(balance)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <MonoLabel>This Month Income</MonoLabel>
            <div className="money text-lg font-bold mt-1" style={{ color: "var(--positive)" }}>
              +{formatINR(thisMonth.income)}
            </div>
          </div>
          <div>
            <MonoLabel>This Month Expenses</MonoLabel>
            <div className="money text-lg font-bold mt-1">-{formatINR(thisMonth.expense)}</div>
          </div>
        </div>
      </GlassCard>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold">Ledger</h2>
        {grouped.length === 0 ? (
          <GlassCard radius={20} padding="32px 24px" className="text-center">
            <p className="text-sm text-muted">No transactions on this account yet.</p>
          </GlassCard>
        ) : (
          grouped.map((month) => (
            <GlassCard key={month.monthKey} radius={20} padding="0">
              <div className="px-4 py-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                <MonoLabel>{month.label}</MonoLabel>
              </div>
              {month.days.map((day) => (
                <div key={day.dateKey}>
                  <div className="px-4 pt-3 pb-1">
                    <MonoLabel>{day.label}</MonoLabel>
                  </div>
                  <div className="px-1 pb-1">
                    {day.transactions.map((t) => (
                      <ActivityRow key={t.id} transaction={t} balanceAfter={balanceById.get(t.id)} showBalance />
                    ))}
                  </div>
                </div>
              ))}
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
