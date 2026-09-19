import type { Account, CreditCard, Transaction, Category } from "@/lib/types";
import {
  getAccountBalance,
  getCreditCardStatus,
  getNetWorth,
  getSpendingByCategory,
  getMonthSummary,
  getCategoryMonthOverMonthChange,
} from "@/lib/ledger/uiAdapters";
import { formatINR } from "@/lib/utils";

/**
 * Controlled query engine for the /assistant chat page. Intents are matched
 * with simple string/regex heuristics; every answer is computed for real by
 * calling ledger functions against the live store — the "AI" here only
 * chooses which function to call and how to phrase the result.
 */

export interface QueryContext {
  accounts: Account[];
  creditCards: CreditCard[];
  transactions: Transaction[];
}

const CATEGORY_WORDS: Category[] = [
  "Groceries",
  "Food & Dining",
  "Transportation",
  "Fuel",
  "Shopping",
  "Bills & Utilities",
  "Entertainment",
  "Subscriptions",
  "Healthcare",
];

function findCategoryInText(text: string): Category | undefined {
  const lower = text.toLowerCase();
  for (const cat of CATEGORY_WORDS) {
    if (lower.includes(cat.toLowerCase()) || lower.includes(cat.split(" ")[0].toLowerCase())) return cat;
  }
  if (/dining|food|restaurant|eat/i.test(lower)) return "Food & Dining";
  if (/grocery|groceries/i.test(lower)) return "Groceries";
  if (/fuel|petrol|diesel/i.test(lower)) return "Fuel";
  return undefined;
}

export function get_spending_summary(ctx: QueryContext, category?: Category): string {
  const month = new Date();
  const byCategory = getSpendingByCategory(ctx.transactions, month);
  if (category) {
    const row = byCategory.find((r: { category: string; amount: number }) => r.category === category);
    const amount = row?.amount ?? 0;
    const change = getCategoryMonthOverMonthChange(ctx.transactions, category);
    const trend =
      change.previous > 0
        ? ` That's ${Math.abs(Math.round(change.pctChange))}% ${change.pctChange >= 0 ? "higher" : "lower"} than last month.`
        : "";
    return `You've spent ${formatINR(amount)} on ${category} this month.${trend}`;
  }
  if (byCategory.length === 0) return "No spending recorded this month yet.";
  const top = byCategory.slice(0, 3).map((r) => `${r.category} (${formatINR(r.amount)})`).join(", ");
  const total = byCategory.reduce((s, r) => s + r.amount, 0);
  return `This month you've spent ${formatINR(total)} in total. Top categories: ${top}.`;
}

export function get_credit_card_status(ctx: QueryContext): string {
  if (ctx.creditCards.length === 0) return "You have no credit cards on file.";
  const lines = ctx.creditCards.map((c: CreditCard) => {
    const s = getCreditCardStatus(c, ctx.transactions);
    return `${c.name}: ${formatINR(s.currentOutstanding)} outstanding, ${formatINR(s.amountDue)} due on ${s.dueDate}`;
  });
  const total = ctx.creditCards.reduce((s: number, c: CreditCard) => s + getCreditCardStatus(c, ctx.transactions).currentOutstanding, 0);
  return `Across your credit cards you owe ${formatINR(total)} in total. ${lines.join("; ")}.`;
}

export function get_net_worth(ctx: QueryContext): string {
  const { assets, liabilities, netWorth } = getNetWorth(ctx.accounts, ctx.creditCards, ctx.transactions);
  return `Your net worth is ${formatINR(netWorth)} — ${formatINR(assets)} in assets minus ${formatINR(liabilities)} in liabilities.`;
}

export function get_account_balance(ctx: QueryContext, query: string): string {
  const lower = query.toLowerCase();
  const acc = ctx.accounts.find((a) => lower.includes(a.bank.split(" ")[0].toLowerCase()) || lower.includes(a.name.toLowerCase()));
  if (!acc) {
    const lines = ctx.accounts.map((a) => `${a.name}: ${formatINR(getAccountBalance(a, ctx.transactions))}`);
    return `Here are your account balances: ${lines.join(", ")}.`;
  }
  return `${acc.name} has a balance of ${formatINR(getAccountBalance(acc, ctx.transactions))}.`;
}

export function search_transactions(ctx: QueryContext, query: string): string {
  const lower = query.toLowerCase();
  const matches = ctx.transactions.filter((t) => t.merchant.toLowerCase().includes(lower) || t.category.toLowerCase().includes(lower));
  if (matches.length === 0) return `I couldn't find any transactions matching "${query}".`;
  const total = matches.reduce((s, t) => s + (t.transaction_type === "expense" ? t.amount : 0), 0);
  return `Found ${matches.length} transaction(s) matching "${query}", totalling ${formatINR(total)}.`;
}

export function get_month_summary(ctx: QueryContext): string {
  const s = getMonthSummary(ctx.transactions);
  return `This month: income ${formatINR(s.income)}, expenses ${formatINR(s.expense)}, savings ${formatINR(s.savings)} (${s.savingsRate.toFixed(0)}% savings rate).`;
}

/** Very small intent router: string-matches the question to one of the query functions above. */
export function answerQuestion(ctx: QueryContext, question: string): string {
  const lower = question.toLowerCase();

  if (/net worth/.test(lower)) return get_net_worth(ctx);

  if (/(owe|outstanding|credit card).*(due|owe|outstanding)?|credit card status/.test(lower) && /credit card|card/.test(lower)) {
    return get_credit_card_status(ctx);
  }

  if (/balance/.test(lower)) return get_account_balance(ctx, lower);

  if (/(spend|spent|spending)/.test(lower)) {
    const category = findCategoryInText(lower);
    return get_spending_summary(ctx, category);
  }

  if (/savings rate|income vs expense|cash flow|this month/.test(lower)) return get_month_summary(ctx);

  if (/find|search|show me/.test(lower)) {
    const merchantMatch = question.match(/(?:for|from|at)\s+([A-Za-z ]+)$/i);
    return search_transactions(ctx, merchantMatch ? merchantMatch[1].trim() : question);
  }

  return "I can answer questions about spending by category, credit card dues, account balances, net worth, and monthly cash flow. Try: \"How much did I spend on groceries this month?\"";
}
