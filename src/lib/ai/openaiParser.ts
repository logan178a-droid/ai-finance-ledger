import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { formatISO } from "date-fns";
import type { Category, ParsedTransaction, ParserContext, TransactionType } from "@/lib/types";
import { findAccount, findAccountByKeyword, findByBankAndLastFour, findCardByKeyword, KNOWN_CATEGORIES } from "@/lib/ai/parseTransaction";
import { getOpenAIClient } from "@/lib/ai/openaiClient";

/**
 * Real LLM-backed parser, implementing the exact same output contract as the
 * regex `transactionParser` (`ParsedTransaction`), so nothing downstream —
 * the API route's response shape, the capture-flow state machine, the
 * confirmation UI — needs to change based on which parser produced the data.
 *
 * The model NEVER supplies a database ID directly. It only proposes free-text
 * hints (`payment_hint`, `transfer_to_hint`); this file resolves those hints
 * against the user's REAL accounts/cards (passed in via `ctx`) using the same
 * keyword-matching helpers the regex parser uses. If nothing resolves
 * confidently, the field is left undefined and surfaces via `missing_fields`
 * / `needsClarification`, exactly like the regex path — the model is never
 * trusted to invent or guess an account/card id.
 */

const OpenAiExtraction = z.object({
  transaction_type: z.enum(["expense", "income", "transfer", "credit_card_payment", "refund"]),
  amount: z.number().nullable(),
  merchant: z.string().nullable(),
  category: z.enum(KNOWN_CATEGORIES as [Category, ...Category[]]).nullable(),
  transaction_date: z.string().nullable().describe("Resolved to an ISO yyyy-MM-dd date using the provided 'today' reference date and user timezone."),
  payment_hint: z.string().nullable().describe("Free-text mention of the bank account, cash, or credit card used — e.g. 'HDFC card', 'SBI', 'cash'. Null if not mentioned."),
  transfer_to_hint: z.string().nullable().describe("For transfers only: free-text mention of the destination account."),
  last_four_digits: z
    .string()
    .nullable()
    .describe(
      "If the text mentions a masked account/card number ending in 4 digits — e.g. 'Card x1253', 'a/c XX1234', 'A/c no. XXXXXX5678', 'ending 4321' — extract exactly those 4 digits here (digits only, no letters/X). This is the single most reliable way to identify which real account/card was used (bank SMS almost always include it), so extract it whenever present, separately from payment_hint. Null if no such masked number appears."
    ),
  bank_name: z
    .string()
    .nullable()
    .describe(
      "The bank or card-issuer name, if identifiable from the text or sender — e.g. 'Kotak', 'HDFC Bank', 'SBI', 'ICICI Bank'. Extract this generally for ANY Indian bank/issuer, not just a fixed set — look for a recognizable institution name near the start of the message or near the account/card reference. Null if genuinely not identifiable."
    ),
  account_type: z
    .enum(["credit_card", "bank_account"])
    .nullable()
    .describe(
      "Whether the masked account/card reference is a credit card or a bank account (savings/current), based on wording like 'Credit Card', 'Card x####' (usually credit card) vs 'a/c', 'account', 'debit card' (bank account). Null if unclear."
    ),
  confidence: z.object({
    amount: z.number().min(0).max(1),
    merchant: z.number().min(0).max(1),
    category: z.number().min(0).max(1),
    payment_hint: z.number().min(0).max(1),
    transaction_date: z.number().min(0).max(1),
  }),
});


export interface UnresolvedAccountHint {
  bank: string;
  last4: string;
  accountType: "credit_card" | "bank_account";
}

export interface OpenAiParseResult {
  parsed: ParsedTransaction;
  /** Set when a masked account/card reference (last-4 digits) didn't match any of the user's existing accounts/cards — the caller (with DB access) decides whether to auto-create from this. */
  unresolvedAccountHint?: UnresolvedAccountHint;
}

function inferAccountType(text: string, hint: "credit_card" | "bank_account" | null): "credit_card" | "bank_account" {
  if (hint) return hint;
  return /credit\s*card/i.test(text) ? "credit_card" : "bank_account";
}

export async function parseWithOpenAI(
  text: string,
  ctx: ParserContext,
  opts: { timezone?: string } = {}
): Promise<OpenAiParseResult> {
  const today = formatISO(new Date(), { representation: "date" });
  const timezone = opts.timezone ?? "Asia/Kolkata";

  const completion = await getOpenAIClient().chat.completions.parse({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          `You extract structured personal-finance transaction data for an Indian personal finance app (currency INR). The input is EITHER a natural-language sentence typed/spoken by the user, OR the raw text of a bank/card SMS or push notification the user shared directly into the app (via Android's Share button) — handle both the same way, inferring which kind of input it is from its shape.\n` +
          `Today's date is ${today} (user timezone: ${timezone}). Resolve relative dates ("yesterday", "last Sunday", "two days ago") to an exact ISO date using this reference. Bank SMS dates are often in dd-mm-yy or dd-Mon-yy format (e.g. "18-09-26", "18-Sep-26") — parse those correctly as day-month-year, not month-day-year.\n` +
          `Only choose "transfer" when money moves between the user's OWN two accounts and the text says so explicitly (e.g. "from SBI to HDFC") — a bank SMS only ever describes YOUR side of a transaction, so almost never classify a bank SMS as "transfer"; a UPI payment or fund transfer to someone else is an "expense" (or "income" if money arrived from someone else), not a "transfer". Only choose "credit_card_payment" when the text is about paying off a credit card bill/statement/outstanding (e.g. "payment of INR 5000 received towards your credit card", "bill payment") — never for an ordinary purchase made using a card (that is "expense").\n` +
          `Never invent an amount, merchant, or account name that isn't stated or strongly implied by the text. If something is not mentioned, return null for it and a low confidence score, rather than guessing.\n` +
          `BANK SMS SPECIFICS: these are short, templated, and full of noise that must NEVER end up in "merchant" or any other field — ignore available/avl balance or credit limit figures, "Not you?" / fraud-report / block-card instructions, SMS shortcodes (e.g. "SMS BLOCK to 12345"), reference/transaction IDs, and generic boilerplate. For the merchant, use a real recognizable name if one appears (e.g. "at Reliance Store", "to Rahul Kumar", "UPI/Swiggy"); if the only thing present is an opaque UPI reference code (e.g. "UPI-K-662719385075-GAY") with no readable name, leave merchant null with low confidence rather than using the reference code as the merchant name — a human will fill it in on the confirmation card.\n` +
          `For "payment_hint" and "transfer_to_hint", extract the raw wording used to refer to an account or card (e.g. "HDFC card", "SBI", "cash", "Kotak Credit Card") — do NOT invent an account ID or resolve it yourself; that happens server-side. Separately and in addition, if the text mentions a masked account/card number (e.g. "Card x1253", "a/c XX1234", "ending 4321"), extract that into "last_four_digits", the bank/issuer name into "bank_name", and whether it's a credit card or bank account into "account_type" — this last-4 + bank combination is the most reliable identifier in a bank SMS, and works for ANY Indian bank, not just the well-known ones.\n` +
          `The app currently supports English only. Typed/spoken input may come from speech-to-text, so amounts are sometimes spelled out in words rather than digits — e.g. "five hundred rupees", "three thousand two hundred" — resolve these to the correct numeric amount exactly as if they were written as digits. It may also contain typos, filler words ("um", "like"), or minor mis-transcriptions — be lenient and infer the most likely meaning.\n` +
          `Always output "merchant", "category", "payment_hint", and "transfer_to_hint" in plain English — these fields get matched against the user's real account/card names, which are stored in English.`,
      },
      { role: "user", content: text },
    ],
    response_format: zodResponseFormat(OpenAiExtraction, "transaction_extraction"),
    temperature: 0,
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error("OpenAI returned no structured extraction");
  }

  const transaction_type: TransactionType = parsed.transaction_type;

  // Resolve free-text hints against the user's REAL rows — the model itself
  // never supplies a database id.
  let accountId: string | undefined;
  let creditCardId: string | undefined;
  let transferToId: string | undefined;
  let resolvedConfidence = parsed.confidence.payment_hint;

  // A masked last-4-digit reference (very common in bank/card SMS, e.g.
  // "Card x1253", "a/c XX1234") is a far more reliable identifier than a
  // bank-name keyword — multiple cards from the same bank are common, but
  // the last 4 digits are unambiguous. Try it first, for whichever
  // transaction type; fall through to keyword-based resolution below only
  // if it doesn't resolve (e.g. the user hasn't recorded that card's last 4
  // digits in Settings yet).
  const byLastFour = parsed.last_four_digits ? findByBankAndLastFour(parsed.bank_name, parsed.last_four_digits, ctx) : undefined;

  if (byLastFour) {
    if (byLastFour.isCard) creditCardId = byLastFour.id;
    else accountId = byLastFour.id;
    resolvedConfidence = byLastFour.confidence;
  }

  if (transaction_type === "transfer") {
    if (!accountId) accountId = parsed.payment_hint ? findAccountByKeyword(parsed.payment_hint, ctx.accounts)?.id : undefined;
    transferToId = parsed.transfer_to_hint ? findAccountByKeyword(parsed.transfer_to_hint, ctx.accounts)?.id : undefined;
    if (!accountId && !byLastFour) resolvedConfidence = 0;
  } else if (transaction_type === "credit_card_payment") {
    // payment_hint is ambiguous here (could name the card being paid off, or
    // the account paying from) — try both directions against real rows.
    if (!creditCardId) {
      const card = parsed.payment_hint ? findCardByKeyword(parsed.payment_hint, ctx.creditCards) : undefined;
      creditCardId = card?.id;
    }
    const fromText = `${text} ${parsed.payment_hint ?? ""}`;
    const fromMatch = fromText.match(/from\s+([A-Za-z ]+)/i);
    if (!accountId) accountId = fromMatch ? findAccountByKeyword(fromMatch[1], ctx.accounts)?.id : undefined;
  } else if (!byLastFour) {
    if (parsed.payment_hint) {
      const resolved = findAccount(parsed.payment_hint, ctx);
      if (resolved) {
        resolvedConfidence = Math.min(parsed.confidence.payment_hint, resolved.confidence);
        if (resolved.isCard) creditCardId = resolved.id;
        else accountId = resolved.id;
      } else {
        resolvedConfidence = 0;
      }
    } else {
      resolvedConfidence = 0;
    }
  }

  // A masked number was mentioned but never resolved to a real account/card
  // through any of the paths above — this is a brand-new one, not a
  // missing-info case. The caller (which has DB access) decides whether to
  // auto-create it. Skipped for transfers, which only ever move money
  // between the user's own KNOWN accounts.
  let unresolvedAccountHint: UnresolvedAccountHint | undefined;
  if (parsed.last_four_digits && transaction_type !== "transfer") {
    const stillUnresolved = transaction_type === "credit_card_payment" ? !creditCardId : !accountId && !creditCardId;
    if (stillUnresolved) {
      unresolvedAccountHint = {
        bank: (parsed.bank_name ?? "").trim() || "Unknown",
        last4: parsed.last_four_digits.replace(/\D/g, ""),
        accountType:
          transaction_type === "credit_card_payment" ? "credit_card" : inferAccountType(text, parsed.account_type),
      };
    }
  }

  const missing_fields: string[] = [];
  if (parsed.amount === null) missing_fields.push("amount");
  if (!parsed.merchant) missing_fields.push("merchant");
  if (!parsed.category) missing_fields.push("category");
  if (transaction_type === "transfer") {
    if (!accountId || !transferToId) missing_fields.push("account_id");
  } else if (transaction_type === "credit_card_payment") {
    if (!creditCardId) missing_fields.push("credit_card_id");
    if (!accountId) missing_fields.push("account_id");
  } else if (!accountId && !creditCardId) {
    missing_fields.push("account_id");
  }

  const field = <T,>(value: T | undefined, confidence: number) => ({
    value,
    confidence: value === undefined || value === null ? 0 : confidence,
  });

  const confidences = [
    parsed.confidence.amount,
    parsed.confidence.merchant,
    parsed.confidence.category,
    resolvedConfidence,
    parsed.confidence.transaction_date,
  ].filter((c) => c > 0);

  return {
    parsed: {
      transaction_type: field(transaction_type, 0.9),
      amount: field(parsed.amount ?? undefined, parsed.confidence.amount),
      merchant: field(parsed.merchant ?? undefined, parsed.confidence.merchant),
      category: field((parsed.category as Category) ?? undefined, parsed.confidence.category),
      account_id: field(accountId, resolvedConfidence),
      credit_card_id: field(creditCardId, resolvedConfidence),
      transfer_to_account_id: field(transferToId, resolvedConfidence),
      transaction_date: field(parsed.transaction_date ?? today, parsed.confidence.transaction_date),
      raw_text: text,
      missing_fields,
      overall_confidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0,
    },
    unresolvedAccountHint,
  };
}
