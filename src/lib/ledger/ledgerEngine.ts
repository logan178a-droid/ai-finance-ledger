import { addDays, format, isAfter, isSameMonth, parseISO, startOfMonth } from "date-fns";
import type {
  LedgerAccount,
  LedgerCreditCard,
  LedgerTransaction,
} from "./types";

/**
 * Pure, deterministic ledger computations. Balances are always *recomputed*
 * from the full transaction set — never stored/mutated as a running total
 * that can drift. No DB access happens here; callers (services) fetch rows
 * and pass plain arrays in, which keeps this module unit-testable.
 */

export function computeAccountBalance(
  account: LedgerAccount,
  transactions: LedgerTransaction[]
): number {
  let balance = account.openingBalance;
  for (const t of transactions) {
    if (t.transactionType === "expense" && t.accountId === account.id) {
      balance -= t.amount;
    } else if (
      (t.transactionType === "income" || t.transactionType === "refund") &&
      t.accountId === account.id
    ) {
      balance += t.amount;
    } else if (t.transactionType === "transfer" && t.accountId === account.id) {
      // Transfer legs are stored as two rows sharing transferId: the source
      // leg is an outflow from its account, the destination leg an inflow
      // into its account. Both are tagged transactionType "transfer" with
      // their own accountId — sign is determined by amount sign convention:
      // negative amount = outgoing leg, positive = incoming leg.
      balance += t.amount;
    } else if (t.transactionType === "credit_card_payment" && t.accountId === account.id) {
      balance -= t.amount;
    }
  }
  return round2(balance);
}

export interface CreditCardStatus {
  cardId: string;
  creditLimit: number;
  availableCredit: number;
  currentOutstanding: number;
  currentStatementBalance: number;
  amountDue: number;
  minimumAmountDue: number;
  dueDate: string;
  unbilledSpending: number;
  previousStatementRemaining: number;
  projectedNextStatement: number;
}

/**
 * Statement cycle: the most recent statementDate on/before asOfDate opens
 * the "current" (unbilled) period; the statement before that is the billed
 * statement whose amountDue is tracked. Simplified single-cycle model:
 * spend since the last statementDate = unbilled; spend in the prior cycle
 * (previous statement to last statement) minus payments made after the last
 * statement date = amount currently due.
 */
export function computeCreditCardStatus(
  card: LedgerCreditCard,
  transactions: LedgerTransaction[],
  asOfDate: Date = new Date()
): CreditCardStatus {
  const cardTx = transactions.filter((t) => t.creditCardId === card.id);

  const lastStatementDate = mostRecentStatementDate(card.statementDate, asOfDate);
  const priorStatementDate = mostRecentStatementDate(
    card.statementDate,
    addDays(lastStatementDate, -1)
  );

  let totalCharges = card.openingOutstanding;
  let totalPayments = 0;
  let unbilledSpending = 0;
  let billedThisCycleSpend = 0; // spend in (priorStatementDate, lastStatementDate]
  let paymentsAfterLastStatement = 0;

  for (const t of cardTx) {
    const d = parseISO(t.transactionDate);
    if (t.transactionType === "expense") {
      totalCharges += t.amount;
      if (isAfter(d, lastStatementDate)) {
        unbilledSpending += t.amount;
      } else if (isAfter(d, priorStatementDate)) {
        billedThisCycleSpend += t.amount;
      }
    } else if (t.transactionType === "refund") {
      totalCharges -= t.amount;
      if (isAfter(d, lastStatementDate)) unbilledSpending -= t.amount;
    } else if (t.transactionType === "credit_card_payment") {
      totalPayments += t.amount;
      if (isAfter(d, lastStatementDate)) paymentsAfterLastStatement += t.amount;
    }
  }

  const currentOutstanding = round2(Math.max(0, totalCharges - totalPayments));
  const currentStatementBalance = round2(Math.max(0, billedThisCycleSpend));
  const previousStatementRemaining = round2(
    Math.max(0, currentStatementBalance - paymentsAfterLastStatement)
  );
  const amountDue = previousStatementRemaining;
  const minimumAmountDue = round2(Math.max(0, amountDue * 0.05));
  const availableCredit = round2(Math.max(0, card.creditLimit - currentOutstanding));

  const dueDate = format(
    monthDayOnOrAfter(lastStatementDate, card.paymentDueDate),
    "yyyy-MM-dd"
  );

  return {
    cardId: card.id,
    creditLimit: card.creditLimit,
    availableCredit,
    currentOutstanding,
    currentStatementBalance,
    amountDue,
    minimumAmountDue,
    dueDate,
    unbilledSpending: round2(Math.max(0, unbilledSpending)),
    previousStatementRemaining,
    projectedNextStatement: round2(Math.max(0, unbilledSpending)),
  };
}

function mostRecentStatementDate(statementDay: number, asOf: Date): Date {
  const y = asOf.getFullYear();
  const m = asOf.getMonth();
  const candidate = new Date(y, m, statementDay);
  if (candidate.getTime() <= asOf.getTime()) return candidate;
  return new Date(y, m - 1, statementDay);
}

function monthDayOnOrAfter(from: Date, day: number): Date {
  const candidate = new Date(from.getFullYear(), from.getMonth(), day);
  if (candidate.getTime() >= from.getTime()) return candidate;
  return new Date(from.getFullYear(), from.getMonth() + 1, day);
}

export function computeNetWorth(
  accounts: LedgerAccount[],
  cards: LedgerCreditCard[],
  transactions: LedgerTransaction[],
  asOfDate: Date = new Date()
) {
  const assets = round2(
    accounts.reduce((sum, a) => sum + computeAccountBalance(a, transactions), 0)
  );
  const liabilities = round2(
    cards.reduce(
      (sum, c) => sum + computeCreditCardStatus(c, transactions, asOfDate).currentOutstanding,
      0
    )
  );
  return { assets, liabilities, netWorth: round2(assets - liabilities) };
}

/** Spending totals exclude transfers and credit-card payments by design. */
export function isSpendTransaction(t: LedgerTransaction): boolean {
  return t.transactionType === "expense";
}

export function computeSpendingByCategory(
  transactions: LedgerTransaction[],
  month?: Date
): { category: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (!isSpendTransaction(t)) continue;
    if (month && !isSameMonth(parseISO(t.transactionDate), month)) continue;
    const cat = t.categoryName ?? "Other";
    map.set(cat, round2((map.get(cat) ?? 0) + t.amount));
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function computeCashFlow(transactions: LedgerTransaction[], monthsBack = 6) {
  const now = new Date();
  const months: { label: string; monthStart: Date }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: format(d, "MMM yyyy"), monthStart: startOfMonth(d) });
  }
  return months.map(({ label, monthStart }) => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      const d = parseISO(t.transactionDate);
      if (!isSameMonth(d, monthStart)) continue;
      // transfers and credit_card_payment are explicitly excluded from
      // both income and expense totals.
      if (t.transactionType === "income" || t.transactionType === "refund") income += t.amount;
      if (t.transactionType === "expense") expense += t.amount;
    }
    return {
      month: label,
      income: round2(income),
      expense: round2(expense),
      savings: round2(income - expense),
    };
  });
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
