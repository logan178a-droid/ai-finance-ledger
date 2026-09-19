// Shared Prisma-row -> pure-ledger-row mappers. Decimal -> number conversion
// happens exactly once, here, at the service boundary — nothing downstream
// (ledgerEngine, selectors, API responses) touches Prisma.Decimal directly.

import type {
  FinancialAccount as PrismaFinancialAccount,
  CreditCard as PrismaCreditCard,
  Transaction as PrismaTransaction,
} from "@prisma/client";
import type { LedgerAccount, LedgerCreditCard, LedgerTransaction } from "@/lib/ledger/types";

export function toLedgerAccount(a: PrismaFinancialAccount): LedgerAccount {
  return {
    id: a.id,
    type: a.type,
    name: a.name,
    openingBalance: Number(a.openingBalance),
  };
}

export function toLedgerCard(c: PrismaCreditCard): LedgerCreditCard {
  return {
    id: c.id,
    name: c.name,
    creditLimit: Number(c.creditLimit),
    statementDate: c.statementDay,
    paymentDueDate: c.paymentDueDay,
    openingOutstanding: Number(c.openingOutstanding),
  };
}

export function toLedgerTransaction(
  t: PrismaTransaction & { category?: { name: string } | null }
): LedgerTransaction {
  return {
    id: t.id,
    transactionType: t.transactionType,
    amount: Number(t.amount),
    transactionDate: t.transactionDate.toISOString(),
    accountId: t.accountId,
    creditCardId: t.creditCardId,
    transferId: t.transferId,
    categoryName: t.category?.name ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}
