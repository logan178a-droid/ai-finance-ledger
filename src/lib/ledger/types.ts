// Plain-JS row shapes used by the pure ledger engine. These mirror the Prisma
// models but use `number` for money (converted from Decimal at the service
// boundary) so the engine is trivially unit-testable without a DB.

export type LedgerAccountType = "bank" | "cash" | "investment";

export interface LedgerAccount {
  id: string;
  type: LedgerAccountType;
  name: string;
  openingBalance: number;
}

export interface LedgerCreditCard {
  id: string;
  name: string;
  creditLimit: number;
  statementDate: number; // day of month 1-28
  paymentDueDate: number; // day of month 1-28
  openingOutstanding: number;
}

export type LedgerTransactionType =
  | "expense"
  | "income"
  | "transfer"
  | "credit_card_payment"
  | "refund";

export interface LedgerTransaction {
  id: string;
  transactionType: LedgerTransactionType;
  amount: number;
  transactionDate: string; // ISO date
  accountId?: string | null;
  creditCardId?: string | null;
  transferId?: string | null;
  categoryName?: string | null;
  createdAt?: string;
}
