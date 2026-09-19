import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma, TransactionType, TransactionSource } from "@prisma/client";

export interface CreateTransactionInput {
  transactionType: TransactionType;
  amount: number;
  currency?: string;
  transactionDate: string; // ISO date
  postingDate?: string | null;
  merchant?: string | null;
  categoryId?: string | null;
  subcategory?: string | null;
  accountId?: string | null;
  creditCardId?: string | null;
  notes?: string | null;
  source?: TransactionSource;
  aiConfidence?: unknown;
}

export type UpdateTransactionInput = Partial<CreateTransactionInput>;

async function assertOwnership(userId: string, input: Pick<CreateTransactionInput, "accountId" | "creditCardId" | "categoryId">) {
  if (input.accountId) {
    const acc = await prisma.financialAccount.findFirst({ where: { id: input.accountId, userId } });
    if (!acc) throw new ServiceError("Account not found", 400);
  }
  if (input.creditCardId) {
    const card = await prisma.creditCard.findFirst({ where: { id: input.creditCardId, userId } });
    if (!card) throw new ServiceError("Credit card not found", 400);
  }
  if (input.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: input.categoryId, OR: [{ userId: null }, { userId }] } });
    if (!cat) throw new ServiceError("Category not found", 400);
  }
}

export class ServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function listTransactions(userId: string, opts: { limit?: number } = {}) {
  return prisma.transaction.findMany({
    where: { userId },
    include: { category: true },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    take: opts.limit,
  });
}

export async function getTransaction(userId: string, id: string) {
  return prisma.transaction.findFirst({ where: { id, userId }, include: { category: true } });
}

export async function createTransaction(userId: string, input: CreateTransactionInput) {
  await assertOwnership(userId, input);

  const tx = await prisma.$transaction(async (db) => {
    const created = await db.transaction.create({
      data: {
        userId,
        transactionType: input.transactionType,
        amount: input.amount,
        currency: input.currency ?? "INR",
        transactionDate: new Date(input.transactionDate),
        postingDate: input.postingDate ? new Date(input.postingDate) : null,
        merchant: input.merchant ?? null,
        categoryId: input.categoryId ?? null,
        subcategory: input.subcategory ?? null,
        accountId: input.accountId ?? null,
        creditCardId: input.creditCardId ?? null,
        notes: input.notes ?? null,
        source: input.source ?? "manual",
        aiConfidence: input.aiConfidence as Prisma.InputJsonValue | undefined,
      },
    });
    await db.transactionAudit.create({
      data: { transactionId: created.id, userId, action: "created", newValues: created as unknown as Prisma.InputJsonValue },
    });
    return created;
  });

  return tx;
}

export async function updateTransaction(userId: string, id: string, input: UpdateTransactionInput) {
  const existing = await getTransaction(userId, id);
  if (!existing) throw new ServiceError("Transaction not found", 404);
  await assertOwnership(userId, input);

  return prisma.$transaction(async (db) => {
    const updated = await db.transaction.update({
      where: { id },
      data: {
        ...(input.transactionType !== undefined && { transactionType: input.transactionType }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.transactionDate !== undefined && { transactionDate: new Date(input.transactionDate) }),
        ...(input.postingDate !== undefined && { postingDate: input.postingDate ? new Date(input.postingDate) : null }),
        ...(input.merchant !== undefined && { merchant: input.merchant }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.subcategory !== undefined && { subcategory: input.subcategory }),
        ...(input.accountId !== undefined && { accountId: input.accountId }),
        ...(input.creditCardId !== undefined && { creditCardId: input.creditCardId }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
    await db.transactionAudit.create({
      data: {
        transactionId: id,
        userId,
        action: "updated",
        previousValues: existing as unknown as Prisma.InputJsonValue,
        newValues: updated as unknown as Prisma.InputJsonValue,
      },
    });
    return updated;
  });
}

/**
 * Deletes a transaction. If it's one leg of a transfer (both legs share a
 * `transferId`), the paired leg is deleted too, atomically — deleting only
 * one leg would silently leave the other account's balance permanently
 * wrong (money debited from one side with no matching credit, or vice
 * versa).
 */
export async function deleteTransaction(userId: string, id: string) {
  const existing = await getTransaction(userId, id);
  if (!existing) throw new ServiceError("Transaction not found", 404);

  const pairedLeg = existing.transferId
    ? await prisma.transaction.findFirst({
        where: { userId, transferId: existing.transferId, id: { not: id } },
      })
    : null;

  return prisma.$transaction(async (db) => {
    await db.transactionAudit.create({
      data: {
        transactionId: null,
        userId,
        action: "deleted",
        previousValues: existing as unknown as Prisma.InputJsonValue,
      },
    });
    await db.transaction.delete({ where: { id } });

    if (pairedLeg) {
      await db.transactionAudit.create({
        data: {
          transactionId: null,
          userId,
          action: "deleted",
          previousValues: pairedLeg as unknown as Prisma.InputJsonValue,
        },
      });
      await db.transaction.delete({ where: { id: pairedLeg.id } });
    }
  });
}

export interface CreateTransferInput {
  amount: number;
  currency?: string;
  transactionDate: string;
  fromAccountId: string;
  toAccountId: string;
  notes?: string | null;
  source?: TransactionSource;
}

/** Creates two linked legs (outflow + inflow) sharing a transferId, atomically. Never counted as expense/income. */
export async function createTransfer(userId: string, input: CreateTransferInput) {
  if (input.fromAccountId === input.toAccountId) {
    throw new ServiceError("Source and destination accounts must differ", 400);
  }
  const [from, to] = await Promise.all([
    prisma.financialAccount.findFirst({ where: { id: input.fromAccountId, userId } }),
    prisma.financialAccount.findFirst({ where: { id: input.toAccountId, userId } }),
  ]);
  if (!from || !to) throw new ServiceError("Account not found", 400);

  return prisma.$transaction(async (db) => {
    const transferId = randomUUID();
    const date = new Date(input.transactionDate);
    const legOut = await db.transaction.create({
      data: {
        userId,
        transactionType: "transfer",
        // Signed: computeAccountBalance's transfer branch (ledgerEngine.ts)
        // does an unconditional `balance += amount` per leg, distinguishing
        // outflow from inflow purely by sign — so the source leg MUST be
        // negative here, or the source account is credited instead of
        // debited (money is duplicated instead of moved).
        amount: -input.amount,
        currency: input.currency ?? "INR",
        transactionDate: date,
        merchant: "Self Transfer",
        accountId: input.fromAccountId,
        transferId,
        notes: input.notes ?? null,
        source: input.source ?? "manual",
      },
    });
    const legIn = await db.transaction.create({
      data: {
        userId,
        transactionType: "transfer",
        amount: input.amount,
        currency: input.currency ?? "INR",
        transactionDate: date,
        merchant: "Self Transfer",
        accountId: input.toAccountId,
        transferId,
        notes: input.notes ?? null,
        source: input.source ?? "manual",
      },
    });
    await db.transactionAudit.createMany({
      data: [
        { transactionId: legOut.id, userId, action: "created", newValues: legOut as unknown as Prisma.InputJsonValue },
        { transactionId: legIn.id, userId, action: "created", newValues: legIn as unknown as Prisma.InputJsonValue },
      ],
    });
    return { legOut, legIn, transferId };
  });
}

export interface CreateCreditCardPaymentInput {
  amount: number;
  currency?: string;
  transactionDate: string;
  fromAccountId: string;
  creditCardId: string;
  notes?: string | null;
  source?: TransactionSource;
}

/**
 * Atomically creates the paying-account debit and reduces the card's
 * liability. Explicitly NOT an expense record — `computeAccountBalance` and
 * `computeCreditCardStatus` both special-case `credit_card_payment`.
 */
export async function createCreditCardPayment(userId: string, input: CreateCreditCardPaymentInput) {
  const [account, card] = await Promise.all([
    prisma.financialAccount.findFirst({ where: { id: input.fromAccountId, userId } }),
    prisma.creditCard.findFirst({ where: { id: input.creditCardId, userId } }),
  ]);
  if (!account) throw new ServiceError("Account not found", 400);
  if (!card) throw new ServiceError("Credit card not found", 400);

  return prisma.$transaction(async (db) => {
    const created = await db.transaction.create({
      data: {
        userId,
        transactionType: "credit_card_payment",
        amount: input.amount,
        currency: input.currency ?? "INR",
        transactionDate: new Date(input.transactionDate),
        merchant: `${card.name} Bill Payment`,
        accountId: input.fromAccountId,
        creditCardId: input.creditCardId,
        notes: input.notes ?? null,
        source: input.source ?? "manual",
      },
    });
    await db.transactionAudit.create({
      data: { transactionId: created.id, userId, action: "created", newValues: created as unknown as Prisma.InputJsonValue },
    });
    return created;
  });
}
