"use client";

import { useState } from "react";
import { Sparkles, AlertCircle } from "lucide-react";
import { useStore } from "@/lib/store/StoreContext";
import { CategoryIcon } from "@/components/shared/categoryIcon";
import { formatINR, cn } from "@/lib/utils";
import { isAiSource, type Transaction } from "@/lib/types";
import { TransactionDetail } from "@/components/transactions/TransactionDetail";

const LOW_CONFIDENCE = 0.6;

/**
 * One compact transaction row — Description + Amount only by default, with a
 * small secondary "Category · Account" line, per the redesign's minimal-list
 * principle. Tapping smoothly expands it in place to the full contextual
 * detail (`TransactionDetail`) rather than opening a separate screen —
 * chosen over a bottom sheet for consistency across breakpoints (a sheet
 * that slides up loses the row's position in the list, which matters more
 * here than on a single-purpose mobile screen) and because it needs no real
 * device/user testing to get right, unlike a true sheet-vs-inline A/B.
 */
export function ActivityRow({
  transaction,
  balanceAfter,
  showBalance = false,
}: {
  transaction: Transaction;
  balanceAfter?: number;
  showBalance?: boolean;
}) {
  const { accounts, creditCards } = useStore();
  const [expanded, setExpanded] = useState(false);

  const isCredit = transaction.transaction_type === "income" || transaction.transaction_type === "refund";
  const isNeutral = transaction.transaction_type === "transfer" || transaction.transaction_type === "credit_card_payment";
  const accountLabel = accounts.find((a) => a.id === transaction.account_id)?.name ?? creditCards.find((c) => c.id === transaction.credit_card_id)?.name;
  const needsReview = isAiSource(transaction.source) && (transaction.ai_confidence ?? 1) < LOW_CONFIDENCE;

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 rounded-lg"
      >
        <span
          className={cn(
            "h-8 w-8 shrink-0 rounded-full flex items-center justify-center",
            isCredit ? "bg-positive-soft text-positive" : isNeutral ? "bg-background text-muted" : "bg-accent-soft text-accent"
          )}
        >
          <CategoryIcon category={transaction.category} size={15} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{transaction.description}</span>
            {isAiSource(transaction.source) && !needsReview && <Sparkles size={11} className="text-ai shrink-0" aria-label="Added by AI" />}
            {needsReview && (
              <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-warning-soft text-warning shrink-0">
                <AlertCircle size={10} /> Needs review
              </span>
            )}
          </div>
          <div className="text-xs text-muted truncate">
            {transaction.category}
            {accountLabel ? ` · ${accountLabel}` : ""}
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className={cn("text-sm font-semibold money", isCredit ? "text-positive" : isNeutral ? "text-muted" : "text-foreground")}>
            {isCredit ? "+" : isNeutral ? "" : "-"}
            {formatINR(transaction.amount)}
          </div>
          {showBalance && balanceAfter !== undefined && <div className="text-[11px] text-muted money">{formatINR(balanceAfter)}</div>}
        </div>
      </button>

      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="px-3.5 pb-4 pt-1">{expanded && <TransactionDetail transaction={transaction} balanceAfter={balanceAfter} />}</div>
        </div>
      </div>
    </div>
  );
}
