import { prisma } from "@/lib/prisma";
import type { FinancialAccountType } from "@prisma/client";
import { computeAccountBalance } from "@/lib/ledger/ledgerEngine";
import { toLedgerAccount, toLedgerTransaction } from "./mappers";
import { ServiceError } from "./transactionService";

export async function listAccounts(userId: string) {
  return prisma.financialAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

export interface CreateAccountInput {
  type: FinancialAccountType;
  name: string;
  institution?: string | null;
  openingBalance?: number;
  currency?: string;
  lastFourDigits?: string;
}

export async function createAccount(userId: string, input: CreateAccountInput) {
  return prisma.financialAccount.create({
    data: {
      userId,
      type: input.type,
      name: input.name,
      institution: input.institution ?? null,
      openingBalance: input.openingBalance ?? 0,
      currency: input.currency ?? "INR",
      ...(input.lastFourDigits !== undefined && { lastFourDigits: input.lastFourDigits }),
    },
  });
}

export interface UpdateAccountInput {
  name?: string;
  institution?: string | null;
  lastFourDigits?: string;
}

/** Currently used to let the user add/edit the last-4-digit hint after creation (Settings → Cards & Accounts), for bank-SMS/share-to-app matching. */
export async function updateAccount(userId: string, accountId: string, input: UpdateAccountInput) {
  const existing = await getAccount(userId, accountId);
  if (!existing) throw new ServiceError("Account not found", 404);
  return prisma.financialAccount.update({
    where: { id: accountId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.institution !== undefined && { institution: input.institution }),
      ...(input.lastFourDigits !== undefined && { lastFourDigits: input.lastFourDigits }),
    },
  });
}

export async function getAccount(userId: string, accountId: string) {
  return prisma.financialAccount.findFirst({ where: { id: accountId, userId } });
}

/** Balance is always recomputed from the full transaction history — never a stored running total. */
export async function getAccountBalance(userId: string, accountId: string): Promise<number> {
  const account = await getAccount(userId, accountId);
  if (!account) return 0;
  const transactions = await prisma.transaction.findMany({ where: { userId } });
  return computeAccountBalance(toLedgerAccount(account), transactions.map(toLedgerTransaction));
}

/**
 * Blocks deletion if any transaction still references this account —
 * silently deleting them would rewrite the user's spending/net-worth
 * history. The user has to delete or reassign those transactions first.
 */
export async function deleteAccount(userId: string, accountId: string) {
  const account = await getAccount(userId, accountId);
  if (!account) throw new ServiceError("Account not found", 404);

  const txCount = await prisma.transaction.count({ where: { userId, accountId } });
  if (txCount > 0) {
    throw new ServiceError(
      `This account has ${txCount} transaction${txCount === 1 ? "" : "s"} on it. Delete or edit those first before removing the account.`,
      409
    );
  }

  await prisma.financialAccount.delete({ where: { id: accountId } });
}

export async function listAccountsWithBalances(userId: string) {
  const [accounts, transactions] = await Promise.all([
    listAccounts(userId),
    prisma.transaction.findMany({ where: { userId } }),
  ]);
  const ledgerTx = transactions.map(toLedgerTransaction);
  return accounts.map((a) => ({
    ...a,
    balance: computeAccountBalance(toLedgerAccount(a), ledgerTx),
  }));
}
