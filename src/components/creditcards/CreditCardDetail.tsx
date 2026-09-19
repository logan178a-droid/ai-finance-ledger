"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store/StoreContext";
import { getCreditCardStatus } from "@/lib/ledger/uiAdapters";
import { formatINR, cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
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
        <div className="h-11 w-11 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
          <CardIcon size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{card.name}</h1>
          {card.bank && <p className="text-sm text-muted">{card.bank}</p>}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Credit Limit" value={formatINR(card.creditLimit)} />
        <Stat label="Available Credit" value={formatINR(status.availableCredit)} />
        <Stat label="Current Outstanding" value={formatINR(status.currentOutstanding)} tone="danger" />
        <Stat label="Current Statement Balance" value={formatINR(status.statementBalance)} />
        <Stat label="Amount Due" value={formatINR(status.amountDue)} tone="danger" />
        <Stat label="Minimum Due" value={formatINR(status.minimumDue)} />
        <Stat label="Unbilled (current cycle) Spending" value={formatINR(status.unbilledSpending)} />
        <Stat label="Previous Statement Remaining" value={formatINR(status.previousStatementRemaining)} />
        <Stat label="Projected Next Statement" value={formatINR(status.projectedNextStatement)} />
        <Stat label="Due Date" value={format(parseISO(status.dueDate), "d MMM yyyy")} />
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Credit Utilization</h3>
        <div className="h-2.5 rounded-full bg-background overflow-hidden">
          <div
            className={cn("h-full rounded-full", utilization > 70 ? "bg-danger" : "bg-accent")}
            style={{ width: `${utilization}%` }}
          />
        </div>
        <p className="text-xs text-muted mt-2">{utilization}% of {formatINR(card.creditLimit)} limit used</p>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4">Billing Cycle Timeline</h3>
        <BillingTimeline card={card} dueDate={status.dueDate} />
      </Card>

      <Card>
        <div className="px-5 pt-5 pb-2">
          <h3 className="text-sm font-semibold">Card Activity</h3>
        </div>
        <ul className="px-3 pb-4">
          {cardTx.slice(0, 10).map((t) => (
            <li key={t.id} className="flex items-center justify-between px-2 py-2.5 rounded-xl hover:bg-background text-sm">
              <div>
                <div className="font-medium">{t.merchant}</div>
                <div className="text-xs text-muted">{format(parseISO(t.transaction_date), "d MMM yyyy")} · {t.category}</div>
              </div>
              <div className={cn("font-semibold", t.transaction_type === "credit_card_payment" ? "text-accent" : "text-foreground")}>
                {t.transaction_type === "credit_card_payment" ? "-" : ""}
                {formatINR(t.amount)}
              </div>
            </li>
          ))}
          {cardTx.length === 0 && <li className="text-sm text-muted text-center py-6">No activity yet.</li>}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted mb-1.5">{label}</div>
      <div className={cn("text-lg font-semibold", tone === "danger" && "text-danger")}>{value}</div>
    </Card>
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
