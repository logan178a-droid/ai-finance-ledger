"use client";

import Link from "next/link";
import { useStore } from "@/lib/store/StoreContext";
import { getUpcomingPayments } from "@/lib/ledger/uiAdapters";
import { formatINR } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { format, parseISO } from "date-fns";
import { CalendarClock } from "lucide-react";

export function UpcomingPayments() {
  const { creditCards, transactions } = useStore();
  const upcoming = getUpcomingPayments(creditCards, transactions);

  return (
    <Card>
      <CardHeader title="Upcoming Payments" subtitle="Credit card dues" />
      <div className="px-5 pb-5 pt-2 space-y-3">
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">No dues right now.</p>
        ) : (
          upcoming.map((s: { card: { id: string; name: string }; dueDate: string; amountDue: number }) => (
            <Link
              key={s.card.id}
              href={`/credit-cards/${s.card.id}`}
              className="flex items-center gap-3 rounded-xl border border-border px-3 py-3 hover:border-accent/40 transition-colors"
            >
              <div className="h-9 w-9 shrink-0 rounded-full bg-danger-soft text-danger flex items-center justify-center">
                <CalendarClock size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{s.card.name}</div>
                <div className="text-xs text-muted">Due {format(parseISO(s.dueDate), "d MMM")}</div>
              </div>
              <div className="text-sm font-semibold shrink-0">{formatINR(s.amountDue)}</div>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
