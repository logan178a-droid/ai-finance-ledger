// Core domain types for AI Finance Ledger

export type AccountType = "bank" | "cash" | "investment";

export interface Account {
  id: string;
  name: string;
  bank: string;
  type: AccountType;
  openingBalance: number;
  currency: "INR";
  accountNumberMasked?: string;
  /** Optional — enables matching "a/c XX1234" in a shared bank SMS to this real account by digit. */
  lastFourDigits?: string;
}

export interface CreditCard {
  id: string;
  name: string;
  bank: string;
  network: "Visa" | "Mastercard" | "RuPay" | "Amex";
  creditLimit: number;
  openingOutstanding: number;
  statementDay: number; // day of month statement is generated
  dueDay: number; // day of month payment is due
  minDuePercent: number; // e.g. 0.05
  lastStatementBalance: number; // balance as of last statement generation
  lastStatementDate: string; // ISO date of last statement
  currency: "INR";
  /** Optional — enables matching "Card x1253" in a shared bank SMS to this real card by digit. */
  lastFourDigits?: string;
}

export type TransactionType =
  | "expense"
  | "income"
  | "transfer"
  | "credit_card_payment"
  | "refund";

export type Category =
  | "Groceries"
  | "Food & Dining"
  | "Transportation"
  | "Fuel"
  | "Shopping"
  | "Bills & Utilities"
  | "Entertainment"
  | "Subscriptions"
  | "Salary"
  | "Transfer"
  | "Credit Card Payment"
  | "Healthcare"
  | "Investment"
  | "Other";

/** Category -> allowed subcategories. The AI picks both from natural input; the main transaction list only ever shows Category, subcategory surfaces on expansion. Free text is still accepted (stored as-is) since a user's real spending never perfectly fits a fixed list. */
export const CATEGORY_SUBCATEGORIES: Record<Category, string[]> = {
  Groceries: ["Supermarket", "Local Market", "Online Grocery"],
  "Food & Dining": ["Restaurant", "Food Delivery", "Cafe", "Snacks"],
  Transportation: ["Cab/Auto", "Public Transport", "Parking", "Metro"],
  Fuel: ["Petrol", "Diesel", "CNG"],
  Shopping: ["Clothing", "Electronics", "Household", "Personal Care", "Other"],
  "Bills & Utilities": ["Electricity", "Water", "Internet", "Mobile", "Gas"],
  Entertainment: ["Movies", "Events", "Gaming", "Streaming"],
  Subscriptions: ["Streaming", "Software", "News", "Fitness"],
  Salary: ["Monthly Salary", "Bonus", "Reimbursement"],
  Transfer: ["Self Transfer"],
  "Credit Card Payment": ["Bill Payment"],
  Healthcare: ["Medicine", "Doctor Visit", "Hospital", "Insurance"],
  Investment: ["Mutual Fund", "Stocks", "Fixed Deposit", "Gold", "Crypto"],
  Other: ["Uncategorized"],
};

export type TransactionSource = "manual" | "ai_text" | "ai_voice" | "ai_share" | "seed";

export function isAiSource(source: TransactionSource): boolean {
  return source === "ai_text" || source === "ai_voice" || source === "ai_share";
}

export const SOURCE_LABEL: Record<TransactionSource, string> = {
  manual: "Manual",
  ai_text: "AI Text",
  ai_voice: "AI Voice",
  ai_share: "Share",
  seed: "Manual",
};

export interface Transaction {
  id: string;
  transaction_type: TransactionType;
  amount: number;
  currency: "INR";
  transaction_date: string; // ISO date string
  /** Primary human-facing label — "Electricity Bill", "Chicken", "Cash Withdrawal". Falls back to merchant when no explicit description was ever set (older rows). */
  description: string;
  /** Optional, more specific — e.g. description "Medicines", merchant "Apollo Pharmacy". */
  merchant?: string;
  category: Category;
  subcategory?: string;
  account_id?: string; // account debited/credited (bank/cash)
  credit_card_id?: string; // credit card used (for expense) or paid off (for payment)
  transfer_to_account_id?: string; // for transfers between own accounts
  transfer_id?: string; // groups a transfer pair
  notes?: string;
  source: TransactionSource;
  ai_confidence?: number; // 0-1 overall confidence
  raw_text?: string; // original natural-language input
  created_at: string;
}

export interface FieldConfidence {
  value: string | number | undefined;
  confidence: number; // 0-1
}

export interface ParsedTransaction {
  transaction_type: FieldConfidence & { value: TransactionType | undefined };
  amount: FieldConfidence & { value: number | undefined };
  /** Primary label — what the AI thinks a human would call this ("Medicines"), not just the raw merchant name. */
  description: FieldConfidence & { value: string | undefined };
  merchant: FieldConfidence & { value: string | undefined };
  category: FieldConfidence & { value: Category | undefined };
  subcategory: FieldConfidence & { value: string | undefined };
  account_id: FieldConfidence & { value: string | undefined };
  credit_card_id: FieldConfidence & { value: string | undefined };
  transfer_to_account_id: FieldConfidence & { value: string | undefined };
  transaction_date: FieldConfidence & { value: string | undefined };
  raw_text: string;
  missing_fields: string[];
  overall_confidence: number;
}

export interface TransactionParser {
  parse(text: string, context: ParserContext): ParsedTransaction;
}

export interface ParserContext {
  accounts: Account[];
  creditCards: CreditCard[];
}

/** Describes an account/card that was auto-created on the fly while resolving a shared SMS — surfaced to the UI so the user always sees it happened, never silently. */
export interface NewAccountInfo {
  kind: "account" | "card";
  id: string;
  name: string;
}
