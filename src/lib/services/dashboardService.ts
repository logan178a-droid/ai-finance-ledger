// Maps real DB rows into the exact UI-facing shapes (`Account`, `CreditCard`,
// `Transaction` from `@/lib/types`) that `src/lib/ledger/selectors.ts` and the
// existing dashboard components already consume via `buildSnapshot(...)`.
// This is the seam that lets the Dashboard page reuse every selector/UI
// component unmodified while swapping the data source from StoreContext to
// Prisma.

import { prisma } from "@/lib/prisma";
import type {
  Account as UiAccount,
  CreditCard as UiCreditCard,
  Transaction as UiTransaction,
  Category as UiCategory,
} from "@/lib/types";
import type {
  FinancialAccount as PrismaFinancialAccount,
  CreditCard as PrismaCreditCard,
  Transaction as PrismaTransaction,
} from "@prisma/client";

function toUiAccount(a: PrismaFinancialAccount): UiAccount {
  return {
    id: a.id,
    name: a.name,
    bank: a.institution ?? "",
    type: a.type,
    openingBalance: Number(a.openingBalance),
    currency: "INR",
    lastFourDigits: a.lastFourDigits || undefined,
  };
}

function toUiCreditCard(c: PrismaCreditCard): UiCreditCard {
  return {
    id: c.id,
    name: c.name,
    bank: c.issuer,
    network: (c.network as UiCreditCard["network"]) || "Visa",
    creditLimit: Number(c.creditLimit),
    openingOutstanding: Number(c.openingOutstanding),
    statementDay: c.statementDay,
    dueDay: c.paymentDueDay,
    minDuePercent: 0.05,
    lastStatementBalance: 0,
    lastStatementDate: c.createdAt.toISOString().slice(0, 10),
    currency: "INR",
    lastFourDigits: c.lastFourDigits || undefined,
  };
}

type TxWithCategory = PrismaTransaction & { category?: { name: string } | null };

/**
 * Collapses the DB's per-leg transfer rows (two rows sharing `transferId`)
 * into the single UI `Transaction` shape (`account_id` + `transfer_to_account_id`).
 * Credit-card payments need no collapsing — they're stored as one row with
 * both `accountId` and `creditCardId` set, matching the UI shape directly.
 */
function collapseTransfers(rows: TxWithCategory[]): TxWithCategory[] {
  const byTransfer = new Map<string, TxWithCategory[]>();
  const rest: TxWithCategory[] = [];
  for (const t of rows) {
    if (t.transactionType === "transfer" && t.transferId) {
      const list = byTransfer.get(t.transferId) ?? [];
      list.push(t);
      byTransfer.set(t.transferId, list);
    } else {
      rest.push(t);
    }
  }
  const collapsed: (TxWithCategory & { __toAccountId?: string | null })[] = [...rest];
  for (const legs of byTransfer.values()) {
    const [a, b] = legs.sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime() || x.id.localeCompare(y.id));
    if (!a) continue;
    collapsed.push({ ...a, __toAccountId: b?.accountId ?? null });
  }
  return collapsed;
}

function toUiTransaction(t: TxWithCategory & { __toAccountId?: string | null }): UiTransaction {
  return {
    id: t.id,
    transaction_type: t.transactionType,
    // Transfer legs are stored signed internally (outflow leg negative) so
    // the ledger engine can tell direction apart per-account — but the
    // UI-facing shape always expects a positive magnitude (sign/context is
    // conveyed separately, e.g. via transaction_type), so unsign it here.
    amount: Math.abs(Number(t.amount)),
    currency: "INR",
    transaction_date: t.transactionDate.toISOString().slice(0, 10),
    description: t.description ?? t.merchant ?? "",
    merchant: t.merchant ?? undefined,
    category: (t.category?.name ?? "Other") as UiCategory,
    subcategory: t.subcategory ?? undefined,
    account_id: t.accountId ?? undefined,
    credit_card_id: t.creditCardId ?? undefined,
    transfer_to_account_id: t.__toAccountId ?? undefined,
    transfer_id: t.transferId ?? undefined,
    notes: t.notes ?? undefined,
    source: t.source,
    ai_confidence: typeof t.aiConfidence === "number" ? t.aiConfidence : undefined,
    raw_text: undefined,
    created_at: t.createdAt.toISOString(),
  };
}

export interface DashboardData {
  accounts: UiAccount[];
  creditCards: UiCreditCard[];
  transactions: UiTransaction[];
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const [accounts, creditCards, transactions] = await Promise.all([
    prisma.financialAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.creditCard.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    accounts: accounts.map(toUiAccount),
    creditCards: creditCards.map(toUiCreditCard),
    transactions: collapseTransfers(transactions).map(toUiTransaction),
  };
}
