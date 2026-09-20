"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store/StoreContext";
import { getCreditCardStatus } from "@/lib/ledger/uiAdapters";
import { formatINR, cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/afl/GlassCard";
import { MonoLabel } from "@/components/ui/afl/MonoLabel";
import { CategoryIcon } from "@/components/shared/categoryIcon";
import { CATEGORY_COLOR } from "@/lib/categoryColor";
import { isAiSource } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { ChevronLeft, CreditCard as CardIcon } from "lucide-react";

export function CreditCardDetail({ cardId }: { cardId: string }) {
  const { creditCards, transactions } = useStore();
  const card = creditCards.find((c) => c.id === cardId);

  const status = useMemo(() => (card ? getCreditCardStatus(card, transactions) : null), [card, transactions]);

  const cardTx = useMemo(
    () =>
      [...transactions]
        .filter((t) => t.credit_card_id === cardId)
        .sort((a, b) => parseISO(b.transaction_date).getTime() - parseISO(a.transaction_date).getTime()),
    [transactions, cardId]
  );

  if (!card || !status) return <p className="text-sm text-muted">Card not found.</p>;

  const utilization = Math.min(100, Math.round((status.currentOutstanding / card.creditLimit) * 100));

  return (
    <div className="space-y-6">
      <Link href="/accounts" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft size={16} /> Back to accounts
      </Link>

      <div className="flex items-center gap-3">
        <span
          className="flex shrink-0 items-center justify-center"
          style={{ width: 44, height: 44, borderRadius: 15, background: "rgba(255,143,160,0.12)" }}
        >
          <CardIcon size={20} color="var(--negative)" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{card.name}</h1>
          {card.bank && <MonoLabel>{card.bank}</MonoLabel>}
        </div>
      </div>

      {/* hero: the four fields the spec calls out explicitly */}
      <GlassCard radius={26} padding="22px" tone="hero">
        <div className="grid grid-cols-2 gap-y-5">
          <div>
            <MonoLabel>Current Outstanding</MonoLabel>
            <div className="money text-3xl font-extrabold mt-1" style={{ color: "var(--negative)", letterSpacing: "-0.01em" }}>
              {formatINR(status.currentOutstanding)}
            </div>
          </div>
          <div>
            <MonoLabel>Statement Amount</MonoLabel>
            <div className="money text-2xl font-bold mt-1">{formatINR(status.amountDue)}</div>
          </div>
          <div>
            <MonoLabel>Unbilled</MonoLabel>
            <div className="money text-lg font-semibold mt-1">{formatINR(status.unbilledSpending)}</div>
          </div>
          <div>
            <MonoLabel>Due Date</MonoLabel>
            <div className="text-lg font-semibold mt-1">{format(parseISO(status.dueDate), "d MMM yyyy")}</div>
          </div>
        </div>
      </GlassCard>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Credit Limit" value={formatINR(card.creditLimit)} />
        <Stat label="Available Credit" value={formatINR(status.availableCredit)} />
        <Stat label="Minimum Due" value={formatINR(status.minimumDue)} />
        <Stat label="Previous Statement Remaining" value={formatINR(status.previousStatementRemaining)} />
        <Stat label="Projected Next Statement" value={formatINR(status.projectedNextStatement)} />
      </div>

      <GlassCard radius={20} padding="18px 20px">
        <h3 className="text-sm font-semibold mb-3">Credit Utilization</h3>
        <div className="h-2.5 rounded-full bg-background overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${utilization}%`, background: utilization > 70 ? "var(--negative)" : "var(--accent)" }}
          />
        </div>
        <MonoLabel className="mt-2">
          {utilization}% of {formatINR(card.creditLimit)} limit used
        </MonoLabel>
      </GlassCard>

      <GlassCard radius={20} padding="18px 20px">
        <h3 className="text-sm font-semibold mb-4">Billing Cycle Timeline</h3>
        <BillingTimeline card={card} dueDate={status.dueDate} />
      </GlassCard>

      <GlassCard radius={20} padding="20px 12px 12px">
        <h3 className="text-sm font-semibold px-3 mb-2">Card Activity</h3>
        <ul>
          {cardTx.slice(0, 10).map((t) => {
            const iconColor = CATEGORY_COLOR[t.category] ?? "#7C89B8";
            const isPayment = t.transaction_type === "credit_card_payment";
            return (
              <li key={t.id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-background text-sm">
                <span
                  className="flex shrink-0 items-center justify-center"
                  style={{ width: 34, height: 34, borderRadius: 11, background: `color-mix(in srgb, ${iconColor} 12%, transparent)` }}
                >
                  <CategoryIcon category={t.category} size={15} color={iconColor} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate">{t.description}</span>
                    {isAiSource(t.source) && <span style={{ fontSize: 10, color: "#B49BFF" }}>✦</span>}
                  </div>
                  <MonoLabel className="truncate">
                    {format(parseISO(t.transaction_date), "d MMM yyyy")} · {t.category}
                  </MonoLabel>
                </div>
                <div className={cn("font-semibold shrink-0 money", isPayment ? "text-accent" : "text-foreground")}>
                  {isPayment ? "-" : ""}
                  {formatINR(t.amount)}
                </div>
              </li>
            );
          })}
          {cardTx.length === 0 && <li className="text-sm text-muted text-center py-6">No activity yet.</li>}
        </ul>
      </GlassCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard radius={16} padding="14px 16px">
      <MonoLabel>{label}</MonoLabel>
      <div className="text-lg font-semibold mt-1.5">{value}</div>
    </GlassCard>
  );
}

function BillingTimeline({ card, dueDate }: { card: { statementDay: number; dueDay: number }; dueDate: string }) {
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const pct = Math.round((dayOfMonth / daysInMonth) * 100);

  return (
    <div>
      <div className="relative h-2 rounded-full bg-background mb-2">
        <div className="absolute inset-y-0 left-0 bg-accent/30 rounded-full" style={{ width: `${pct}%` }} />
        <div className="absolute -top-1.5 h-5 w-5 rounded-full border-2 border-accent bg-surface" style={{ left: `calc(${pct}% - 10px)` }} />
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>Statement day: {card.statementDay}</span>
        <span>Today</span>
        <span>Due day: {card.dueDay}</span>
      </div>
      <p className="text-xs text-muted mt-3">Payment due {format(parseISO(dueDate), "d MMM yyyy")}.</p>
    </div>
  );
}
