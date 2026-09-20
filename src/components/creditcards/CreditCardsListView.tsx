"use client";

import Link from "next/link";
import { useStore } from "@/lib/store/StoreContext";
import { getCreditCardStatus } from "@/lib/ledger/uiAdapters";
import { formatINR } from "@/lib/utils";
import { GlassCard } from "@/components/ui/afl/GlassCard";
import { MonoLabel } from "@/components/ui/afl/MonoLabel";
import { Button } from "@/components/ui/Button";
import { format, parseISO } from "date-fns";
import { CreditCard as CardIcon, Plus } from "lucide-react";
import { useState } from "react";
import { AddCreditCardDrawer } from "@/components/accounts/AddCreditCardDrawer";

export function CreditCardsListView() {
  const { creditCards, transactions } = useStore();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Credit Cards</h1>
          <p className="text-sm text-muted mt-1">Outstanding balances, computed live from your transaction history.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Add credit card
        </Button>
      </div>

      {creditCards.length === 0 ? (
        <GlassCard radius={20} padding="32px 24px" className="text-center">
          <p className="text-sm font-medium mb-1">No credit cards yet</p>
          <p className="text-sm text-muted mb-4">Add a card to start tracking its outstanding balance and due dates.</p>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add credit card
          </Button>
        </GlassCard>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {creditCards.map((c) => {
            const status = getCreditCardStatus(c, transactions);
            const utilization = Math.min(100, Math.round((status.currentOutstanding / c.creditLimit) * 100));
            return (
              <Link key={c.id} href={`/credit-cards/${c.id}`}>
                <GlassCard radius={20} padding="18px 18px 16px" tone="hero">
                  <div className="flex items-center gap-3 mb-3.5">
                    <span
                      className="flex shrink-0 items-center justify-center"
                      style={{ width: 34, height: 34, borderRadius: 11, background: "rgba(255,143,160,0.12)" }}
                    >
                      <CardIcon size={15} color="var(--negative)" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{c.name}</div>
                      {c.bank && <MonoLabel className="truncate">{c.bank}</MonoLabel>}
                    </div>
                  </div>
                  <div className="money text-xl font-extrabold mb-2.5" style={{ color: "var(--negative)", letterSpacing: "-0.01em" }}>
                    {formatINR(status.currentOutstanding)}
                  </div>
                  <div className="h-1.5 rounded-full bg-background overflow-hidden mb-3">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${utilization}%`, background: utilization > 70 ? "var(--negative)" : "var(--accent)" }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <MonoLabel>Available {formatINR(status.availableCredit, { compact: true })}</MonoLabel>
                    <MonoLabel>Due {format(parseISO(status.dueDate), "d MMM")}</MonoLabel>
                  </div>
                </GlassCard>
              </Link>
            );
          })}
        </div>
      )}

      <AddCreditCardDrawer open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
