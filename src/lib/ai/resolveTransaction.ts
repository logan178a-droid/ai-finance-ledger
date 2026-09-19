import { formatISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import { transactionParser } from "@/lib/ai/parseTransaction";
import { parseWithOpenAI, resolveExtraction, type OpenAiParseResult, type RawExtraction } from "@/lib/ai/openaiParser";
import { createAccount } from "@/lib/services/accountService";
import { createCreditCard } from "@/lib/services/creditCardService";
import type { Account as UiAccount, CreditCard as UiCreditCard, NewAccountInfo, ParsedTransaction } from "@/lib/types";

function toUiAccount(a: {
  id: string;
  name: string;
  institution: string | null;
  type: string;
  openingBalance: unknown;
  lastFourDigits?: string | null;
}): UiAccount {
  return {
    id: a.id,
    name: a.name,
    bank: a.institution ?? "",
    type: a.type as UiAccount["type"],
    openingBalance: Number(a.openingBalance),
    currency: "INR",
    lastFourDigits: a.lastFourDigits || undefined,
  };
}

function toUiCard(c: {
  id: string;
  name: string;
  issuer: string;
  network?: string;
  creditLimit: unknown;
  openingOutstanding: unknown;
  statementDay: number;
  paymentDueDay: number;
  lastFourDigits?: string | null;
}): UiCreditCard {
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
    lastStatementDate: new Date().toISOString().slice(0, 10),
    currency: "INR",
    lastFourDigits: c.lastFourDigits || undefined,
  };
}

export interface ResolveTransactionResult {
  parsed: ParsedTransaction;
  needsClarification: boolean;
  accounts: UiAccount[];
  creditCards: UiCreditCard[];
  parserUsed: "openai" | "regex-dev";
  /** Set when an account/card mentioned by last-4 digits didn't match anything we knew about and was auto-created on the fly — the UI shows this so it's never a silent change. */
  newAccount?: NewAccountInfo;
}

function recomputeOverallConfidence(parsed: ParsedTransaction): number {
  const confs = [
    parsed.amount.confidence,
    parsed.merchant.confidence,
    parsed.category.confidence,
    parsed.account_id.confidence,
    parsed.credit_card_id.confidence,
    parsed.transaction_date.confidence,
  ].filter((c) => c > 0);
  return confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;
}

/**
 * Shared tail end of resolution: given an already-obtained `OpenAiParseResult`
 * (from wherever it came from — a standalone extraction call, or a merged
 * classify+extract tool call), auto-creates an unrecognized account/card if
 * asked to, and returns the final result. No OpenAI call happens in here.
 */
async function finishFromParseResult(
  userId: string,
  out: OpenAiParseResult,
  accounts: UiAccount[],
  creditCards: UiCreditCard[],
  opts: { autoCreateAccounts?: boolean }
): Promise<{ parsed: ParsedTransaction; newAccount?: NewAccountInfo }> {
  const parsed = out.parsed;
  let newAccount: NewAccountInfo | undefined;

  // The parser recognized a masked account/card number that doesn't match
  // anything we already know about — build a real record for it on the fly
  // instead of blocking on a clarification question, per the "zero setup
  // burden" share-to-app design. Skipped for the typed/voice path
  // (autoCreateAccounts is only passed for shared SMS/notifications — free
  // text doesn't carry the same reliable last-4 signal).
  const hint = out.unresolvedAccountHint;
  if (hint && opts.autoCreateAccounts) {
    const bankLabel = hint.bank === "Unknown" ? null : hint.bank;
    const productLabel = hint.accountType === "credit_card" ? "Credit Card" : "Savings Account";
    const name = `${hint.bank} ${productLabel} •${hint.last4}`;

    let resolvedKey: "account_id" | "credit_card_id";
    if (hint.accountType === "credit_card") {
      const row = await createCreditCard(userId, { name, issuer: bankLabel ?? undefined, lastFourDigits: hint.last4 });
      const uiCard = toUiCard(row);
      creditCards.push(uiCard);
      parsed.credit_card_id = { value: row.id, confidence: 0.9 };
      newAccount = { kind: "card", id: row.id, name };
      resolvedKey = "credit_card_id";
    } else {
      const row = await createAccount(userId, { type: "bank", name, institution: bankLabel, lastFourDigits: hint.last4 });
      const uiAccount = toUiAccount(row);
      accounts.push(uiAccount);
      parsed.account_id = { value: row.id, confidence: 0.9 };
      newAccount = { kind: "account", id: row.id, name };
      resolvedKey = "account_id";
    }

    // For a credit-card bill payment, only clear the field we actually just
    // resolved (the card) — the paying-FROM account may still genuinely be
    // missing from the SMS and should still prompt. For every other type,
    // "account_id" is the one generic marker used whether the resolved
    // payment method turns out to be an account or a card, so clear both.
    const clearedKeys: string[] = parsed.transaction_type.value === "credit_card_payment" ? [resolvedKey] : ["account_id", "credit_card_id"];
    parsed.missing_fields = parsed.missing_fields.filter((f) => !clearedKeys.includes(f));
    parsed.overall_confidence = recomputeOverallConfidence(parsed);
  }

  return { parsed, newAccount };
}

/**
 * The shared entry point for free-text (typed OR transcribed from voice) that
 * has NOT already been through a merged classify+extract call — used by the
 * no-OPENAI_API_KEY fallback route. The primary path (`classifyAndRespond`)
 * uses `resolveTransactionFromExtraction` below instead, since it already
 * has the extraction from its own single classify+extract call and doesn't
 * need a second OpenAI round trip here.
 */
export async function resolveTransactionText(
  userId: string,
  text: string,
  opts: { autoCreateAccounts?: boolean } = {}
): Promise<ResolveTransactionResult> {
  const [accountRows, cardRows, user] = await Promise.all([
    prisma.financialAccount.findMany({ where: { userId } }),
    prisma.creditCard.findMany({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
  ]);
  const accounts = accountRows.map(toUiAccount);
  const creditCards = cardRows.map(toUiCard);

  let parsed: ParsedTransaction;
  let usedAi: "openai" | "regex-dev" = "regex-dev";
  let newAccount: NewAccountInfo | undefined;

  if (process.env.OPENAI_API_KEY) {
    try {
      const out = await parseWithOpenAI(text, { accounts, creditCards }, { timezone: user?.timezone });
      usedAi = "openai";
      const finished = await finishFromParseResult(userId, out, accounts, creditCards, opts);
      parsed = finished.parsed;
      newAccount = finished.newAccount;
    } catch (err) {
      // Never let an OpenAI/network failure be a dead end — fall back to the
      // deterministic regex parser so the user can still complete capture.
      console.error("OpenAI parse failed, falling back to regex parser:", err);
      parsed = transactionParser.parse(text, { accounts, creditCards });
    }
  } else {
    parsed = transactionParser.parse(text, { accounts, creditCards });
  }

  const needsClarification =
    parsed.missing_fields.includes("account_id") || parsed.missing_fields.includes("credit_card_id");

  return { parsed, needsClarification, accounts, creditCards, parserUsed: usedAi, newAccount };
}

/**
 * The fast path: the caller (`classifyAndRespond`) already obtained a raw
 * extraction as part of its single merged classify+extract OpenAI call — this
 * just resolves it against the user's real accounts/cards (a DB read, no
 * further OpenAI call) rather than re-extracting from scratch. Saves one full
 * LLM round trip per capture compared to classifying and extracting
 * separately.
 */
export async function resolveTransactionFromExtraction(
  userId: string,
  text: string,
  extraction: RawExtraction,
  opts: { autoCreateAccounts?: boolean } = {}
): Promise<ResolveTransactionResult> {
  const [accountRows, cardRows] = await Promise.all([
    prisma.financialAccount.findMany({ where: { userId } }),
    prisma.creditCard.findMany({ where: { userId } }),
  ]);
  const accounts = accountRows.map(toUiAccount);
  const creditCards = cardRows.map(toUiCard);

  const today = formatISO(new Date(), { representation: "date" });
  const out = resolveExtraction(extraction, text, { accounts, creditCards }, today);
  const { parsed, newAccount } = await finishFromParseResult(userId, out, accounts, creditCards, opts);

  const needsClarification = parsed.missing_fields.includes("account_id") || parsed.missing_fields.includes("credit_card_id");

  return { parsed, needsClarification, accounts, creditCards, parserUsed: "openai", newAccount };
}
