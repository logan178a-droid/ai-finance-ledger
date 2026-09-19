import { format, parseISO } from "date-fns";
import type { Transaction } from "@/lib/types";

/** Transaction types that count toward a day/month's expense/income totals — transfers and credit-card payments are excluded, same convention as the rest of the ledger engine. */
function amountSign(t: Transaction): 1 | -1 | 0 {
  if (t.transaction_type === "expense") return -1;
  if (t.transaction_type === "income" || t.transaction_type === "refund") return 1;
  return 0;
}

export interface DaySummary {
  dateKey: string; // yyyy-MM-dd
  label: string; // "19 September"
  expenses: number;
  income: number;
  transactions: Transaction[];
}

export interface MonthGroup {
  monthKey: string; // yyyy-MM
  label: string; // "September 2026"
  expenses: number;
  income: number;
  count: number;
  days: DaySummary[];
}

/**
 * Groups a (already-filtered) transaction list into Month -> Day buckets for
 * the Activity view, each carrying its own expense/income totals so the UI
 * never has to re-derive them. Transactions within a day are kept in the
 * order they were passed in (callers sort newest-first beforehand).
 */
export function groupByMonthAndDay(transactions: Transaction[]): MonthGroup[] {
  const monthMap = new Map<string, Map<string, Transaction[]>>();

  for (const t of transactions) {
    const d = parseISO(t.transaction_date);
    const monthKey = format(d, "yyyy-MM");
    const dayKey = t.transaction_date;
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, new Map());
    const dayMap = monthMap.get(monthKey)!;
    if (!dayMap.has(dayKey)) dayMap.set(dayKey, []);
    dayMap.get(dayKey)!.push(t);
  }

  const months: MonthGroup[] = [];
  for (const [monthKey, dayMap] of monthMap) {
    const days: DaySummary[] = [];
    let monthExpenses = 0;
    let monthIncome = 0;
    let count = 0;

    for (const [dateKey, txs] of dayMap) {
      let expenses = 0;
      let income = 0;
      for (const t of txs) {
        const sign = amountSign(t);
        if (sign === -1) expenses += t.amount;
        if (sign === 1) income += t.amount;
      }
      days.push({ dateKey, label: format(parseISO(dateKey), "d MMMM"), expenses, income, transactions: txs });
      monthExpenses += expenses;
      monthIncome += income;
      count += txs.length;
    }

    days.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    months.push({
      monthKey,
      label: format(parseISO(`${monthKey}-01`), "MMMM yyyy"),
      expenses: monthExpenses,
      income: monthIncome,
      count,
      days,
    });
  }

  months.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  return months;
}
