import type { ParsedTransaction, Transaction, TransactionSource } from "@/lib/types";

let counter = 0;

/** Converts a confirmed ParsedTransaction (plus any user-filled gaps) into a real Transaction for the ledger. */
export function buildTransactionFromParsed(
  parsed: ParsedTransaction,
  source: TransactionSource = "ai_text",
  overrides: Partial<Transaction> = {}
): Transaction {
  counter += 1;
  const now = new Date().toISOString();
  return {
    id: `ai-${Date.now()}-${counter}`,
    transaction_type: parsed.transaction_type.value ?? "expense",
    amount: parsed.amount.value ?? 0,
    currency: "INR",
    transaction_date: parsed.transaction_date.value ?? now.slice(0, 10),
    description: parsed.description.value ?? parsed.merchant.value ?? "Unknown",
    merchant: parsed.merchant.value,
    category: parsed.category.value ?? "Other",
    subcategory: parsed.subcategory.value,
    account_id: parsed.account_id.value,
    credit_card_id: parsed.credit_card_id.value,
    transfer_to_account_id: parsed.transfer_to_account_id.value,
    source,
    ai_confidence: parsed.overall_confidence,
    raw_text: parsed.raw_text,
    created_at: now,
    ...overrides,
  };
}
