// Selector layer: adapts the UI-facing domain types (Account, CreditCard,
// Transaction from `@/lib/types`) to the pure ledger engine's row shapes and
// exposes small, purpose-built `get*` functions the UI reads through. This is
// the single seam to change when the data source moves from StoreContext to
// real API routes — components never do their own math against raw state.

import { parseISO, isSameMonth, subMonths, isAfter, compareAsc } from "date-fns";
import type { Account, CreditCard, Transaction, Category } from "@/lib/types";
import {
  computeAccountBalance,
  computeAccountRunningBalances,
  computeCreditCardRunningOutstanding,
  computeCreditCardStatus,
  computeNetWorth,
  computeSpendingByCategory,
  computeCashFlow,
  type CreditCardStatus,
} from "./ledgerEngine";
import type { LedgerAccount, LedgerCreditCard, LedgerTransaction } from "./types";

function toLedgerAccount(a: Account): LedgerAccount {
  return { id: a.id, type: a.type, name: a.name, openingBalance: a.openingBalance };
}

function toLedgerCard(c: CreditCard): LedgerCreditCard {
  return {
    id: c.id,
    name: c.name,
    creditLimit: c.creditLimit,
    statementDate: c.statementDay,
    paymentDueDate: c.dueDay,
    openingOutstanding: c.openingOutstanding,
  };
}

/**
 * Expands each UI Transaction into the ledger engine's per-leg rows. Transfers
 * and credit-card payments touch two "accounts" (source/destination, or
 * account+card) — the engine expects one row per leg with a signed amount.
 */
function toLedgerTransactions(transactions: Transaction[]): LedgerTransaction[] {
  const rows: LedgerTransaction[] = [];
  for (const t of transactions) {
    const base = {
      transactionDate: t.transaction_date,
      categoryName: t.category,
      createdAt: t.created_at,
    };
    if (t.transaction_type === "transfer") {
      if (t.account_id) {
        rows.push({ id: `${t.id}-out`, transactionType: "transfer", amount: -t.amount, accountId: t.account_id, transferId: t.id, ...base });
      }
      if (t.transfer_to_account_id) {
        rows.push({ id: `${t.id}-in`, transactionType: "transfer", amount: t.amount, accountId: t.transfer_to_account_id, transferId: t.id, ...base });
      }
    } else if (t.transaction_type === "credit_card_payment") {
      if (t.account_id) {
        rows.push({ id: `${t.id}-acc`, transactionType: "credit_card_payment", amount: t.amount, accountId: t.account_id, ...base });
      }
      if (t.credit_card_id) {
        rows.push({ id: `${t.id}-cc`, transactionType: "credit_card_payment", amount: t.amount, creditCardId: t.credit_card_id, ...base });
      }
    } else {
      rows.push({
        id: t.id,
        transactionType: t.transaction_type,
        amount: t.amount,
        accountId: t.account_id ?? null,
        creditCardId: t.credit_card_id ?? null,
        ...base,
      });
    }
  }
  return rows;
}

export interface LedgerSnapshot {
  accounts: Account[];
  creditCards: CreditCard[];
  transactions: Transaction[];
  ledgerAccounts: LedgerAccount[];
  ledgerCards: LedgerCreditCard[];
  ledgerTx: LedgerTransaction[];
}

export function buildSnapshot(accounts: Account[], creditCards: CreditCard[], transactions: Transaction[]): LedgerSnapshot {
  return {
    accounts,
    creditCards,
    transactions,
    ledgerAccounts: accounts.map(toLedgerAccount),
    ledgerCards: creditCards.map(toLedgerCard),
    ledgerTx: toLedgerTransactions(transactions),
  };
}

export function getAccountBalance(snap: LedgerSnapshot, accountId: string): number {
  const acc = snap.ledgerAccounts.find((a) => a.id === accountId);
  if (!acc) return 0;
  return computeAccountBalance(acc, snap.ledgerTx);
}

export function getBankAndCashBalance(snap: LedgerSnapshot) {
  let bank = 0;
  let cash = 0;
  let investments = 0;
  for (const a of snap.ledgerAccounts) {
    const bal = computeAccountBalance(a, snap.ledgerTx);
    if (a.type === "bank") bank += bal;
    else if (a.type === "cash") cash += bal;
    else if (a.type === "investment") investments += bal;
  }
  return { bank: round2(bank), cash: round2(cash), investments: round2(investments) };
}

/** Bank+cash balance trend across recent months — real per-account math, filtered by date, not a fabricated series. Used for the Home Total Balance sparkline/growth badge. */
export function getBankCashTrend(snap: LedgerSnapshot, monthsBack = 6): { label: string; value: number }[] {
  const points: { label: string; value: number }[] = [];
  const now = new Date();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const asOf = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const txUpToDate = snap.ledgerTx.filter((t) => parseISO(t.transactionDate) <= asOf);
    let total = 0;
    for (const a of snap.ledgerAccounts) {
      if (a.type !== "bank" && a.type !== "cash") continue;
      total += computeAccountBalance(a, txUpToDate);
    }
    points.push({ label: asOf.toLocaleDateString("en-IN", { month: "short" }), value: round2(total) });
  }
  return points;
}

export function getCreditCardStatus(snap: LedgerSnapshot, cardId: string): CreditCardStatus | undefined {
  const card = snap.ledgerCards.find((c) => c.id === cardId);
  if (!card) return undefined;
  return computeCreditCardStatus(card, snap.ledgerTx);
}

export function getAllCreditCardStatuses(snap: LedgerSnapshot): CreditCardStatus[] {
  return snap.ledgerCards.map((c) => computeCreditCardStatus(c, snap.ledgerTx));
}

export function getNetWorth(snap: LedgerSnapshot) {
  return computeNetWorth(snap.ledgerAccounts, snap.ledgerCards, snap.ledgerTx);
}

/** Net worth trend across recent months, for the dashboard hero sparkline. */
export function getNetWorthTrend(snap: LedgerSnapshot, monthsBack = 6): { label: string; value: number }[] {
  const points: { label: string; value: number }[] = [];
  const now = new Date();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const asOf = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); // last day of that month
    const label = asOf.toLocaleDateString("en-IN", { month: "short" });
    const { netWorth } = computeNetWorth(snap.ledgerAccounts, snap.ledgerCards, snap.ledgerTx, asOf);
    points.push({ label, value: netWorth });
  }
  return points;
}

export function getMonthSummary(snap: LedgerSnapshot, month: Date = new Date()) {
  let income = 0;
  let expense = 0;
  for (const t of snap.transactions) {
    const d = parseISO(t.transaction_date);
    if (!isSameMonth(d, month)) continue;
    if (t.transaction_type === "income" || t.transaction_type === "refund") income += t.amount;
    if (t.transaction_type === "expense") expense += t.amount;
  }
  const savings = round2(income - expense);
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;
  return { income: round2(income), expense: round2(expense), savings, savingsRate };
}

export function getSpendingByCategory(snap: LedgerSnapshot, month: Date = new Date()) {
  return computeSpendingByCategory(snap.ledgerTx, month);
}

export function getCategoryMonthOverMonthChange(snap: LedgerSnapshot, category: Category, month: Date = new Date()) {
  const current = computeSpendingByCategory(snap.ledgerTx, month).find((c) => c.category === category)?.amount ?? 0;
  const previous = computeSpendingByCategory(snap.ledgerTx, subMonths(month, 1)).find((c) => c.category === category)?.amount ?? 0;
  const pctChange = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  return { current, previous, pctChange };
}

export function getCashFlow(snap: LedgerSnapshot, monthsBack = 6) {
  return computeCashFlow(snap.ledgerTx, monthsBack);
}

export interface UpcomingDue {
  card: CreditCard;
  status: CreditCardStatus;
  dueDate: string;
  amountDue: number;
  isDueSoon: boolean;
}

export function getUpcomingPayments(snap: LedgerSnapshot, dueSoonDays = 7): UpcomingDue[] {
  const now = new Date();
  const results: UpcomingDue[] = [];
  for (const card of snap.creditCards) {
    const status = getCreditCardStatus(snap, card.id);
    if (!status || status.amountDue <= 0) continue;
    const due = parseISO(status.dueDate);
    const daysUntil = Math.ceil((due.getTime() - now.getTime()) / 86400000);
    results.push({
      card,
      status,
      dueDate: status.dueDate,
      amountDue: status.amountDue,
      isDueSoon: daysUntil <= dueSoonDays,
    });
  }
  return results.sort((a, b) => compareAsc(parseISO(a.dueDate), parseISO(b.dueDate)));
}

export interface LedgerRow {
  transaction: Transaction;
  balanceAfter: number;
}

/** Strips the `-out`/`-in`/`-acc`/`-cc` leg suffix `toLedgerTransactions` adds for transfers/credit-card payments, back to the real UI Transaction id. */
function baseTransactionId(legId: string): string {
  return legId.replace(/-(out|in|acc|cc)$/, "");
}

/**
 * The real per-account ledger: every transaction that touches this account,
 * oldest-first internally for the running-balance math, returned newest-first
 * (the natural reading order for a ledger page) with each row's balance
 * meaning "this account's balance immediately after this transaction" — never
 * a global number, per the accounting model.
 */
export function getAccountLedgerRows(snap: LedgerSnapshot, accountId: string): LedgerRow[] {
  const acc = snap.ledgerAccounts.find((a) => a.id === accountId);
  if (!acc) return [];
  const runningByLegId = new Map(computeAccountRunningBalances(acc, snap.ledgerTx).map((r) => [r.id, r.balanceAfter]));
  const byId = new Map(snap.transactions.map((t) => [t.id, t]));

  const rows: LedgerRow[] = [];
  for (const [legId, balanceAfter] of runningByLegId) {
    const t = byId.get(baseTransactionId(legId));
    if (t) rows.push({ transaction: t, balanceAfter });
  }
  return rows.sort((a, b) => {
    const byDate = compareAsc(parseISO(b.transaction.transaction_date), parseISO(a.transaction.transaction_date));
    if (byDate !== 0) return byDate;
    return (b.transaction.created_at ?? "").localeCompare(a.transaction.created_at ?? "");
  });
}

/** Same as `getAccountLedgerRows` but for a credit card — balance means outstanding owed on the card immediately after that transaction. */
export function getCreditCardLedgerRows(snap: LedgerSnapshot, cardId: string): LedgerRow[] {
  const card = snap.ledgerCards.find((c) => c.id === cardId);
  if (!card) return [];
  const runningByLegId = new Map(computeCreditCardRunningOutstanding(card, snap.ledgerTx).map((r) => [r.id, r.balanceAfter]));
  const byId = new Map(snap.transactions.map((t) => [t.id, t]));

  const rows: LedgerRow[] = [];
  for (const [legId, balanceAfter] of runningByLegId) {
    const t = byId.get(baseTransactionId(legId));
    if (t) rows.push({ transaction: t, balanceAfter });
  }
  return rows.sort((a, b) => {
    const byDate = compareAsc(parseISO(b.transaction.transaction_date), parseISO(a.transaction.transaction_date));
    if (byDate !== 0) return byDate;
    return (b.transaction.created_at ?? "").localeCompare(a.transaction.created_at ?? "");
  });
}

export function getRecentTransactions(transactions: Transaction[], limit = 8): Transaction[] {
  return [...transactions]
    .sort((a, b) => {
      const byDate = compareAsc(parseISO(b.transaction_date), parseISO(a.transaction_date));
      if (byDate !== 0) return byDate;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    })
    .slice(0, limit);
}

/** True when there isn't enough real history yet for a meaningful trend chart. */
export function hasSufficientTrendData(snap: LedgerSnapshot): boolean {
  const monthsWithData = new Set(
    snap.transactions.map((t) => t.transaction_date.slice(0, 7))
  );
  return monthsWithData.size >= 2;
}

export function isBrandNewAccount(snap: LedgerSnapshot): boolean {
  return snap.transactions.length === 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export { isAfter };
