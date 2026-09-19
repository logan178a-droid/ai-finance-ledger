import { prisma } from "@/lib/prisma";
import { computeCreditCardStatus } from "@/lib/ledger/ledgerEngine";
import { toLedgerCard, toLedgerTransaction } from "./mappers";
import { ServiceError } from "./transactionService";

export async function listCreditCards(userId: string) {
  return prisma.creditCard.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

// Only `name` is required — the user isn't asked for real card details.
// Everything else, if omitted, falls back to the schema's generic default
// (see prisma/schema.prisma) so the credit-card ledger math still works.
export interface CreateCreditCardInput {
  name: string;
  issuer?: string;
  lastFourDigits?: string;
  creditLimit?: number;
  statementDay?: number;
  paymentDueDay?: number;
  openingOutstanding?: number;
}

export async function createCreditCard(userId: string, input: CreateCreditCardInput) {
  return prisma.creditCard.create({
    data: {
      userId,
      name: input.name,
      ...(input.issuer !== undefined && { issuer: input.issuer }),
      ...(input.lastFourDigits !== undefined && { lastFourDigits: input.lastFourDigits }),
      ...(input.creditLimit !== undefined && { creditLimit: input.creditLimit }),
      ...(input.statementDay !== undefined && { statementDay: input.statementDay }),
      ...(input.paymentDueDay !== undefined && { paymentDueDay: input.paymentDueDay }),
      ...(input.openingOutstanding !== undefined && { openingOutstanding: input.openingOutstanding }),
    },
  });
}

export async function getCreditCard(userId: string, cardId: string) {
  return prisma.creditCard.findFirst({ where: { id: cardId, userId } });
}

export interface UpdateCreditCardInput {
  name?: string;
  lastFourDigits?: string;
}

/** Currently used to let the user add/edit the last-4-digit hint after creation (Settings → Cards & Accounts), for bank-SMS/share-to-app matching. */
export async function updateCreditCard(userId: string, cardId: string, input: UpdateCreditCardInput) {
  const existing = await getCreditCard(userId, cardId);
  if (!existing) throw new ServiceError("Credit card not found", 404);
  return prisma.creditCard.update({
    where: { id: cardId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.lastFourDigits !== undefined && { lastFourDigits: input.lastFourDigits }),
    },
  });
}

export async function getCreditCardStatus(userId: string, cardId: string) {
  const card = await getCreditCard(userId, cardId);
  if (!card) return null;
  const transactions = await prisma.transaction.findMany({ where: { userId, creditCardId: cardId } });
  return computeCreditCardStatus(toLedgerCard(card), transactions.map(toLedgerTransaction));
}

/**
 * Blocks deletion if any transaction still references this card — silently
 * deleting them would rewrite the user's spending/statement history. The
 * user has to delete or reassign those transactions first.
 */
export async function deleteCreditCard(userId: string, cardId: string) {
  const card = await getCreditCard(userId, cardId);
  if (!card) throw new ServiceError("Credit card not found", 404);

  const txCount = await prisma.transaction.count({ where: { userId, creditCardId: cardId } });
  if (txCount > 0) {
    throw new ServiceError(
      `This card has ${txCount} transaction${txCount === 1 ? "" : "s"} on it. Delete or edit those first before removing the card.`,
      409
    );
  }

  await prisma.creditCard.delete({ where: { id: cardId } });
}

export async function listCreditCardsWithStatus(userId: string) {
  const [cards, transactions] = await Promise.all([
    listCreditCards(userId),
    prisma.transaction.findMany({ where: { userId } }),
  ]);
  const ledgerTx = transactions.map(toLedgerTransaction);
  return cards.map((c) => ({
    ...c,
    status: computeCreditCardStatus(toLedgerCard(c), ledgerTx),
  }));
}
