import { describe, expect, it } from "vitest";
import {
  computeAccountBalance,
  computeCreditCardStatus,
  computeNetWorth,
  computeSpendingByCategory,
  computeCashFlow,
} from "../ledgerEngine";
import type { LedgerAccount, LedgerCreditCard, LedgerTransaction } from "../types";

const account: LedgerAccount = {
  id: "acc1",
  type: "bank",
  name: "Main Bank",
  openingBalance: 10000,
};

const account2: LedgerAccount = {
  id: "acc2",
  type: "cash",
  name: "Cash",
  openingBalance: 500,
};

const card: LedgerCreditCard = {
  id: "card1",
  name: "Visa",
  creditLimit: 50000,
  statementDate: 5,
  paymentDueDate: 20,
  openingOutstanding: 0,
};

function tx(partial: Partial<LedgerTransaction> & Pick<LedgerTransaction, "id" | "transactionType" | "amount" | "transactionDate">): LedgerTransaction {
  return { accountId: null, creditCardId: null, transferId: null, categoryName: null, ...partial };
}

describe("computeAccountBalance", () => {
  it("expense decreases balance", () => {
    const txs = [tx({ id: "1", transactionType: "expense", amount: 1000, transactionDate: "2026-01-05", accountId: "acc1" })];
    expect(computeAccountBalance(account, txs)).toBe(9000);
  });

  it("income increases balance", () => {
    const txs = [tx({ id: "1", transactionType: "income", amount: 2000, transactionDate: "2026-01-05", accountId: "acc1" })];
    expect(computeAccountBalance(account, txs)).toBe(12000);
  });

  it("transfer moves money without net spend and legs sum to zero", () => {
    const txs = [
      tx({ id: "1", transactionType: "transfer", amount: -1000, transactionDate: "2026-01-05", accountId: "acc1", transferId: "t1" }),
      tx({ id: "2", transactionType: "transfer", amount: 1000, transactionDate: "2026-01-05", accountId: "acc2", transferId: "t1" }),
    ];
    expect(computeAccountBalance(account, txs)).toBe(9000);
    expect(computeAccountBalance(account2, txs)).toBe(1500);
    const legSum = txs.filter((t) => t.transferId === "t1").reduce((s, t) => s + t.amount, 0);
    expect(legSum).toBe(0);
    // Transfers must not appear as spend
    const spending = computeSpendingByCategory(txs);
    expect(spending.length).toBe(0);
  });

  it("credit card payment debits the paying account and is not an expense", () => {
    const txs = [
      tx({ id: "1", transactionType: "credit_card_payment", amount: 3000, transactionDate: "2026-01-10", accountId: "acc1", creditCardId: "card1" }),
    ];
    expect(computeAccountBalance(account, txs)).toBe(7000);
    expect(computeSpendingByCategory(txs).length).toBe(0);
  });

  it("edit recalculates correctly (replace a transaction amount)", () => {
    const original = [tx({ id: "1", transactionType: "expense", amount: 1000, transactionDate: "2026-01-05", accountId: "acc1" })];
    expect(computeAccountBalance(account, original)).toBe(9000);
    const edited = [tx({ id: "1", transactionType: "expense", amount: 1500, transactionDate: "2026-01-05", accountId: "acc1" })];
    expect(computeAccountBalance(account, edited)).toBe(8500);
  });

  it("delete recalculates correctly (transaction removed from set)", () => {
    const withTx = [tx({ id: "1", transactionType: "expense", amount: 1000, transactionDate: "2026-01-05", accountId: "acc1" })];
    expect(computeAccountBalance(account, withTx)).toBe(9000);
    expect(computeAccountBalance(account, [])).toBe(10000);
  });
});

describe("computeCreditCardStatus", () => {
  it("purchase increases outstanding", () => {
    const txs = [tx({ id: "1", transactionType: "expense", amount: 5000, transactionDate: "2026-01-10", creditCardId: "card1" })];
    const status = computeCreditCardStatus(card, txs, new Date("2026-01-15"));
    expect(status.currentOutstanding).toBe(5000);
  });

  it("full payment decreases outstanding without becoming an expense", () => {
    const txs = [
      tx({ id: "1", transactionType: "expense", amount: 5000, transactionDate: "2026-01-10", creditCardId: "card1" }),
      tx({ id: "2", transactionType: "credit_card_payment", amount: 5000, transactionDate: "2026-01-18", creditCardId: "card1", accountId: "acc1" }),
    ];
    const status = computeCreditCardStatus(card, txs, new Date("2026-01-19"));
    expect(status.currentOutstanding).toBe(0);
    // The expense (5000) is the only real spend; the payment must not add to it.
    const spending = computeSpendingByCategory(txs);
    expect(spending.reduce((s, c) => s + c.amount, 0)).toBe(5000);
  });

  it("partial payment leaves remaining amount due", () => {
    // statement generated Jan 5 covering spend before that date
    const txs = [
      tx({ id: "1", transactionType: "expense", amount: 10000, transactionDate: "2025-12-20", creditCardId: "card1" }),
      tx({ id: "2", transactionType: "credit_card_payment", amount: 4000, transactionDate: "2026-01-10", creditCardId: "card1", accountId: "acc1" }),
    ];
    const status = computeCreditCardStatus(card, txs, new Date("2026-01-15"));
    expect(status.currentOutstanding).toBe(6000);
    expect(status.amountDue).toBe(6000);
  });
});

describe("computeSpendingByCategory", () => {
  it("excludes transfers and card payments, sums expenses by category", () => {
    const txs = [
      tx({ id: "1", transactionType: "expense", amount: 500, transactionDate: "2026-01-05", accountId: "acc1", categoryName: "Groceries" }),
      tx({ id: "2", transactionType: "expense", amount: 300, transactionDate: "2026-01-07", accountId: "acc1", categoryName: "Groceries" }),
      tx({ id: "3", transactionType: "transfer", amount: -1000, transactionDate: "2026-01-05", accountId: "acc1", transferId: "t1" }),
      tx({ id: "4", transactionType: "credit_card_payment", amount: 1000, transactionDate: "2026-01-05", accountId: "acc1", creditCardId: "card1" }),
    ];
    const byCat = computeSpendingByCategory(txs);
    expect(byCat).toEqual([{ category: "Groceries", amount: 800 }]);
  });
});

describe("computeNetWorth", () => {
  it("computes assets minus liabilities", () => {
    const txs = [
      tx({ id: "1", transactionType: "expense", amount: 5000, transactionDate: "2026-01-10", creditCardId: "card1" }),
    ];
    const nw = computeNetWorth([account, account2], [card], txs, new Date("2026-01-15"));
    expect(nw.assets).toBe(10500);
    expect(nw.liabilities).toBe(5000);
    expect(nw.netWorth).toBe(5500);
  });
});

describe("computeCashFlow", () => {
  it("excludes transfers and card payments from income/expense", () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const txs = [
      tx({ id: "1", transactionType: "income", amount: 50000, transactionDate: dateStr, accountId: "acc1" }),
      tx({ id: "2", transactionType: "expense", amount: 12000, transactionDate: dateStr, accountId: "acc1" }),
      tx({ id: "3", transactionType: "transfer", amount: -1000, transactionDate: dateStr, accountId: "acc1", transferId: "t1" }),
    ];
    const flow = computeCashFlow(txs, 1);
    expect(flow[0].income).toBe(50000);
    expect(flow[0].expense).toBe(12000);
    expect(flow[0].savings).toBe(38000);
  });
});
