"use client";

import Link from "next/link";
import { useStore } from "@/lib/store/StoreContext";
import { getCreditCardStatus } from "@/lib/ledger/uiAdapters";
import { formatINR } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
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
        <Card className="p-8 text-center">
          <p className="text-sm font-medium mb-1">No credit cards yet</p>
          <p className="text-sm text-muted mb-4">Add a card to start tracking its outstanding balance and due dates.</p>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add credit card
          </Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {creditCards.map((c) => {
            const status = getCreditCardStatus(c, transactions);
            const utilization = Math.min(100, Math.round((status.currentOutstanding / c.creditLimit) * 100));
            return (
              <Link key={c.id} href={`/credit-cards/${c.id}`}>
                <Card className="p-5 hover:border-accent/40 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
                        <CardIcon size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{c.name}</div>
                        {c.bank && <div className="text-xs text-muted">{c.bank}</div>}
                      </div>
                    </div>
                    <div className="text-lg font-semibold text-danger">{formatINR(status.currentOutstanding)}</div>
                  </div>
                  <div className="h-1.5 rounded-full bg-background overflow-hidden mb-3">
                    <div
                      className={utilization > 70 ? "h-full rounded-full bg-danger" : "h-full rounded-full bg-accent"}
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Available: {formatINR(status.availableCredit)}</span>
                    <span>Due {format(parseISO(status.dueDate), "d MMM")}</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <AddCreditCardDrawer open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
