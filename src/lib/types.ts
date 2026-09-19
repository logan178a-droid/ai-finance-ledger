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
  | "Other";

export type TransactionSource = "ai" | "manual" | "seed";

export interface Transaction {
  id: string;
  transaction_type: TransactionType;
  amount: number;
  currency: "INR";
  transaction_date: string; // ISO date string
  merchant: string;
  category: Category;
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
  merchant: FieldConfidence & { value: string | undefined };
  category: FieldConfidence & { value: Category | undefined };
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
