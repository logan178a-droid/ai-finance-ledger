// Backward-compatible adapter functions with the OLD (Account/CreditCard/
// Transaction-based) signatures that a few not-yet-redesigned screens
// (Accounts, Credit Card detail, the /assistant query engine) still call
// directly. New code should prefer `@/lib/ledger/selectors`, which works off
// a single `LedgerSnapshot` built once per render. This file exists purely
// so those out-of-scope screens keep compiling and working unchanged.

import type { Account, CreditCard, Transaction, Category } from "@/lib/types";
import {
  buildSnapshot,
  getCreditCardStatus as _status,
  getUpcomingPayments as _upcoming,
  getCashFlow as _cashFlow,
  getNetWorth as _netWorth,
  getBankAndCashBalance as _bankAndCash,
} from "./selectors";
import { computeAccountBalance } from "./ledgerEngine";

export function getAccountBalance(account: Account, transactions: Transaction[]): number {
  const snap = buildSnapshot([account], [], transactions);
  if (!snap.ledgerAccounts.length) return 0;
  return computeAccountBalance(snap.ledgerAccounts[0], snap.ledgerTx);
}

export interface CompatCreditCardStatus {
  cardId: string;
  creditLimit: number;
  availableCredit: number;
  currentOutstanding: number;
  statementBalance: number;
  amountDue: number;
  minimumDue: number;
  dueDate: string;
  unbilledSpending: number;
  previousStatementRemaining: number;
  projectedNextStatement: number;
}

export function getCreditCardStatus(card: CreditCard, transactions: Transaction[]): CompatCreditCardStatus {
  const snap = buildSnapshot([], [card], transactions);
  const s = _status(snap, card.id)!;
  return {
    cardId: s.cardId,
    creditLimit: s.creditLimit,
    availableCredit: s.availableCredit,
    currentOutstanding: s.currentOutstanding,
    statementBalance: s.currentStatementBalance,
    amountDue: s.amountDue,
    minimumDue: s.minimumAmountDue,
    dueDate: s.dueDate,
    unbilledSpending: s.unbilledSpending,
    previousStatementRemaining: s.previousStatementRemaining,
    projectedNextStatement: s.projectedNextStatement,
  };
}

export function getMonthlyCashFlow(transactions: Transaction[], monthsBack = 6) {
  const snap = buildSnapshot([], [], transactions);
  return _cashFlow(snap, monthsBack);
}

export function getSpendingByCategory(transactions: Transaction[], month: Date = new Date()) {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.transaction_type !== "expense") continue;
    if (!sameMonth(t.transaction_date, month)) continue;
    map.set(t.category, round2((map.get(t.category) ?? 0) + t.amount));
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function getCategoryMonthOverMonthChange(transactions: Transaction[], category: Category, month: Date = new Date()) {
  const current = getSpendingByCategory(transactions, month).find((c) => c.category === category)?.amount ?? 0;
  const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const previous = getSpendingByCategory(transactions, prevMonth).find((c) => c.category === category)?.amount ?? 0;
  const pctChange = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  return { current, previous, pctChange };
}

export function getMonthSummary(transactions: Transaction[], month: Date = new Date()) {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (!sameMonth(t.transaction_date, month)) continue;
    if (t.transaction_type === "income" || t.transaction_type === "refund") income += t.amount;
    if (t.transaction_type === "expense") expense += t.amount;
  }
  const savings = round2(income - expense);
  return { income: round2(income), expense: round2(expense), savings, savingsRate: income > 0 ? (savings / income) * 100 : 0 };
}

export function getNetWorth(accounts: Account[], creditCards: CreditCard[], transactions: Transaction[]) {
  const snap = buildSnapshot(accounts, creditCards, transactions);
  return _netWorth(snap);
}

export function getBankAndCashBalance(accounts: Account[], transactions: Transaction[]) {
  const snap = buildSnapshot(accounts, [], transactions);
  return _bankAndCash(snap);
}

export function getUpcomingPayments(creditCards: CreditCard[], transactions: Transaction[]) {
  const snap = buildSnapshot([], creditCards, transactions);
  return _upcoming(snap).map((u) => ({ card: u.card, dueDate: u.dueDate, amountDue: u.amountDue }));
}

export function getRecentTransactions(transactions: Transaction[], limit = 8): Transaction[] {
  return [...transactions]
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, limit);
}

function sameMonth(iso: string, month: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
