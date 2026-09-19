import { prisma } from "@/lib/prisma";

export interface TransactionsCsvOptions {
  from?: string; // ISO date, inclusive
  to?: string; // ISO date, inclusive
}

export interface TransactionsCsvResult {
  csv: string;
  count: number;
  rangeLabel: string;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatAmount(n: number): string {
  return n.toFixed(2);
}

const TYPE_LABEL: Record<string, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  credit_card_payment: "Credit Card Payment",
  refund: "Refund",
};

/**
 * Builds a CSV of the user's transactions with a genuine, correctly-signed
 * running balance per row — computed the same way the ledger engine does
 * (opening balance + credits - debits, applied chronologically), not just a
 * dump of stored fields. One row per transaction; for a transaction that
 * touches both a bank account and a credit card (a credit-card bill
 * payment), the running balance shown is the bank account's (the "Account/
 * Card" column still names both where relevant).
 */
export async function buildTransactionsCsv(userId: string, opts: TransactionsCsvOptions = {}): Promise<TransactionsCsvResult> {
  const [accounts, creditCards, transactions] = await Promise.all([
    prisma.financialAccount.findMany({ where: { userId } }),
    prisma.creditCard.findMany({ where: { userId } }),
    prisma.transaction.findMany({
      where: {
        userId,
        ...(opts.from || opts.to
          ? {
              transactionDate: {
                ...(opts.from && { gte: new Date(opts.from) }),
                ...(opts.to && { lte: new Date(opts.to) }),
              },
            }
          : {}),
      },
      include: { category: true },
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const cardName = new Map(creditCards.map((c) => [c.id, c.name]));

  // Running balances, seeded from opening balances, updated chronologically
  // as we walk the (already ascending-sorted) transaction list — exactly
  // the same accrual the ledger engine uses for live balances.
  const accountBalance = new Map(accounts.map((a) => [a.id, Number(a.openingBalance)]));
  const cardOutstanding = new Map(creditCards.map((c) => [c.id, Number(c.openingOutstanding)]));

  const header = ["Date", "Type", "Amount (INR)", "Description", "Merchant", "Category", "Subcategory", "Account/Card", "Running Balance (INR)"];
  const rows: string[][] = [];

  for (const t of transactions) {
    const amount = Number(t.amount);
    const date = t.transactionDate.toISOString().slice(0, 10);
    const type = TYPE_LABEL[t.transactionType] ?? t.transactionType;
    const description = t.description ?? t.merchant ?? "";
    const merchant = t.merchant ?? "";
    const category = t.category?.name ?? "";
    const subcategory = t.subcategory ?? "";

    let signedAmount = amount;
    let runningBalance: number | null = null;
    let entityLabel = "";

    if (t.accountId) {
      let bal = accountBalance.get(t.accountId) ?? 0;
      if (t.transactionType === "expense") {
        bal -= amount;
        signedAmount = -amount;
      } else if (t.transactionType === "income" || t.transactionType === "refund") {
        bal += amount;
        signedAmount = amount;
      } else if (t.transactionType === "transfer") {
        // Already signed at storage time (negative = outflow leg, positive = inflow leg).
        bal += amount;
        signedAmount = amount;
      } else if (t.transactionType === "credit_card_payment") {
        bal -= amount;
        signedAmount = -amount;
      }
      accountBalance.set(t.accountId, bal);
      runningBalance = bal;
      entityLabel = accountName.get(t.accountId) ?? "Account";
    }

    if (t.creditCardId) {
      let out = cardOutstanding.get(t.creditCardId) ?? 0;
      if (t.transactionType === "expense") {
        out += amount;
        if (!t.accountId) signedAmount = -amount;
      } else if (t.transactionType === "credit_card_payment" || t.transactionType === "refund") {
        out -= amount;
      }
      cardOutstanding.set(t.creditCardId, out);
      if (!t.accountId) {
        // Pure card row (no bank account leg) — show outstanding as a
        // negative figure, consistent with it being a liability.
        runningBalance = -out;
        entityLabel = cardName.get(t.creditCardId) ?? "Credit Card";
      } else {
        entityLabel += ` → ${cardName.get(t.creditCardId) ?? "Credit Card"}`;
      }
    }

    rows.push([
      date,
      type,
      formatAmount(signedAmount),
      description,
      merchant,
      category,
      subcategory,
      entityLabel,
      runningBalance !== null ? formatAmount(runningBalance) : "",
    ]);
  }

  const csv = [header, ...rows].map((r) => r.map((cell) => csvEscape(cell)).join(",")).join("\r\n");

  const rangeLabel = opts.from || opts.to ? `${opts.from ?? "the start"} to ${opts.to ?? "today"}` : "all time";

  return { csv, count: transactions.length, rangeLabel };
}
