"use client";

import Link from "next/link";
import { useStore } from "@/lib/store/StoreContext";
import { getRecentTransactions } from "@/lib/ledger/uiAdapters";
import { formatINR, cn } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/shared/categoryIcon";
import { format, parseISO } from "date-fns";
import type { Transaction } from "@/lib/types";

export function RecentTransactions() {
  const { transactions } = useStore();
  const recent = getRecentTransactions(transactions, 8);

  return (
    <Card>
      <CardHeader
        title="Recent Transactions"
        action={
          <Link href="/transactions" className="text-xs text-accent font-medium hover:underline">
            View all
          </Link>
        }
      />
      {recent.length === 0 ? (
        <p className="px-5 pb-5 pt-2 text-sm text-muted">
          No transactions yet — try telling the assistant what you spent.
        </p>
      ) : (
      <ul className="px-3 pb-3 pt-2">
        {recent.map((t: Transaction) => {
          const isCredit = t.transaction_type === "income" || t.transaction_type === "refund";
          const isNeutral = t.transaction_type === "transfer" || t.transaction_type === "credit_card_payment";
          return (
            <li key={t.id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-background transition-colors">
              <div className="h-9 w-9 shrink-0 rounded-full bg-accent-soft text-accent flex items-center justify-center">
                <CategoryIcon category={t.category} size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{t.merchant}</span>
                  {t.source === "ai" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-soft text-accent shrink-0">AI</span>}
                </div>
                <div className="text-xs text-muted">
                  {format(parseISO(t.transaction_date), "d MMM")} · {t.category}
                </div>
              </div>
              <div className={cn("text-sm font-semibold shrink-0", isCredit ? "text-positive" : isNeutral ? "text-muted" : "text-foreground")}>
                {isCredit ? "+" : isNeutral ? "" : "-"}
                {formatINR(t.amount)}
              </div>
            </li>
          );
        })}
      </ul>
      )}
    </Card>
  );
}
