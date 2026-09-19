"use client";

import { Landmark, CreditCard as CardIcon, LineChart as LineChartIcon, CalendarClock } from "lucide-react";
import { useStore } from "@/lib/store/StoreContext";
import {
  buildSnapshot,
  getBankAndCashBalance,
  getAllCreditCardStatuses,
  getMonthSummary,
  getUpcomingPayments,
} from "@/lib/ledger/selectors";
import { formatINR, cn } from "@/lib/utils";
import { MetricCard } from "@/components/ui/MetricCard";
import { Card } from "@/components/ui/Card";
import { format, parseISO } from "date-fns";

/**
 * Tier 2: three distinct position cards (cash, credit-card liabilities never
 * implied as spendable, investments), the month's income/expense/savings,
 * and upcoming dues sorted by urgency.
 */
export function TierTwoMetrics() {
  const { accounts, creditCards, transactions } = useStore();
  const snap = buildSnapshot(accounts, creditCards, transactions);
  const { bank, cash, investments } = getBankAndCashBalance(snap);
  const cardStatuses = getAllCreditCardStatuses(snap);
  const totalLiability = round2(cardStatuses.reduce((s, c) => s + c.currentOutstanding, 0));
  const month = getMonthSummary(snap);
  const upcoming = getUpcomingPayments(snap);

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <MetricCard
        label="Cash Position"
        numericValue={bank + cash}
        icon={<Landmark size={16} />}
        delta={{ value: "Bank + cash on hand", direction: "flat", tone: "neutral" }}
      />
      <MetricCard
        label="Credit Card Liabilities"
        numericValue={totalLiability}
        icon={<CardIcon size={16} />}
        tone="danger"
        delta={{ value: "Owed, not spendable", direction: "flat", tone: "negative" }}
      />
      <MetricCard
        label="Investments"
        numericValue={investments}
        icon={<LineChartIcon size={16} />}
        delta={{ value: "Mutual funds & stocks", direction: "flat", tone: "neutral" }}
      />

      <Card className="p-4 sm:p-5 sm:col-span-2 lg:col-span-2">
        <CardHeaderInline title="This Month" />
        <div className="grid grid-cols-3 gap-3 mt-3">
          <MonthStat label="Income" value={formatINR(month.income)} tone="positive" />
          <MonthStat label="Expenses" value={formatINR(month.expense)} tone="negative" />
          <MonthStat label="Savings" value={formatINR(month.savings)} tone={month.savings >= 0 ? "positive" : "negative"} />
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <CardHeaderInline title="Upcoming Dues" />
        <div className="mt-3 space-y-2">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted">No dues right now.</p>
          ) : (
            upcoming.slice(0, 3).map((u) => (
              <div
                key={u.card.id}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                  u.isDueSoon ? "bg-warning-soft" : "bg-background"
                )}
              >
                <CalendarClock size={14} className={u.isDueSoon ? "text-warning" : "text-muted"} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{u.card.name}</div>
                  <div className="text-xs text-muted">Due {format(parseISO(u.dueDate), "d MMM")}</div>
                </div>
                <div className="money font-semibold shrink-0">{formatINR(u.amountDue)}</div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function CardHeaderInline({ title }: { title: string }) {
  return <h3 className="text-sm font-semibold text-foreground">{title}</h3>;
}

function MonthStat({ label, value, tone }: { label: string; value: string; tone: "positive" | "negative" }) {
  return (
    <div>
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={cn("money text-base font-semibold", tone === "positive" ? "text-positive" : "text-negative")}>{value}</div>
    </div>
  );
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
