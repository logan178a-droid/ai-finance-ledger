import { formatISO } from "date-fns";
import type {
  Account,
  Category,
  CreditCard,
  ParsedTransaction,
  ParserContext,
  TransactionParser,
  TransactionType,
} from "@/lib/types";

/**
 * Rule-based / regex NLP parser. Deliberately built behind the same
 * `TransactionParser` interface a real LLM call (e.g. OpenAI) could
 * implement later — nothing downstream needs to change if it's swapped in.
 * This parser NEVER decides account balances; it only proposes a structured
 * transaction with per-field confidence for the user to confirm.
 */

const MERCHANT_CATEGORY_MAP: Record<string, Category> = {
  reliance: "Groceries",
  "reliance fresh": "Groceries",
  dmart: "Groceries",
  "big bazaar": "Groceries",
  "more supermarket": "Groceries",
  swiggy: "Food & Dining",
  zomato: "Food & Dining",
  uber: "Transportation",
  ola: "Transportation",
  "indian oil": "Fuel",
  "bharat petroleum": "Fuel",
  hp: "Fuel",
  amazon: "Shopping",
  flipkart: "Shopping",
  myntra: "Shopping",
  netflix: "Subscriptions",
  spotify: "Subscriptions",
  "hotstar": "Subscriptions",
  airtel: "Bills & Utilities",
  jio: "Bills & Utilities",
  "electricity board": "Bills & Utilities",
  "electricity": "Bills & Utilities",
  pvr: "Entertainment",
  inox: "Entertainment",
};

const CATEGORY_KEYWORDS: [RegExp, Category][] = [
  [/groceries|grocery/i, "Groceries"],
  [/electricity|water bill|gas bill|utilit(y|ies)|broadband|wifi|internet bill/i, "Bills & Utilities"],
  [/salary|payroll/i, "Salary"],
  [/movie|cinema|netflix|spotify|entertainment/i, "Entertainment"],
  [/subscription/i, "Subscriptions"],
  [/fuel|petrol|diesel/i, "Fuel"],
  [/cab|taxi|uber|ola|auto|transport/i, "Transportation"],
  [/restaurant|dinner|lunch|food|swiggy|zomato|dining/i, "Food & Dining"],
  [/shopping|clothes|amazon|flipkart|myntra/i, "Shopping"],
  [/doctor|hospital|medicine|pharmacy|health/i, "Healthcare"],
];

// Generic bank/keyword aliases used to MATCH the user's real accounts/cards
// (never as literal database IDs — real IDs always come from ctx.accounts /
// ctx.creditCards, resolved by matching these keywords against each row's
// `name`/`bank`, so this works against any user's actual seeded/live data).
const BANK_KEYWORDS: Record<string, string[]> = {
  sbi: ["sbi", "state bank"],
  hdfc: ["hdfc"],
  icici: ["icici"],
  axis: ["axis"],
  cash: ["cash", "wallet"],
  invest: ["mutual fund", "investment", "zerodha", "groww", "stocks"],
};

const CARD_PRODUCT_KEYWORDS: Record<string, string[]> = {
  millennia: ["millennia"],
  "amazon pay": ["amazon pay"],
};

export const KNOWN_CATEGORIES: Category[] = [
  "Groceries",
  "Food & Dining",
  "Transportation",
  "Fuel",
  "Shopping",
  "Bills & Utilities",
  "Entertainment",
  "Subscriptions",
  "Salary",
  "Transfer",
  "Credit Card Payment",
  "Healthcare",
  "Other",
];

/** Resolves free-text bank/account mentions to one of the user's REAL accounts (never a fabricated id). */
export function findAccountByKeyword(text: string, accounts: Account[]): Account | undefined {
  const lower = text.toLowerCase();
  for (const acc of accounts) {
    const haystack = `${acc.name} ${acc.bank}`.toLowerCase();
    for (const aliases of Object.values(BANK_KEYWORDS)) {
      if (aliases.some((a) => lower.includes(a) && haystack.includes(a))) return acc;
    }
  }
  // fall back: bank's own first word appears in text
  for (const acc of accounts) {
    const bankWord = acc.bank.split(" ")[0].toLowerCase();
    if (bankWord.length > 2 && lower.includes(bankWord)) return acc;
  }
  return undefined;
}

/** Resolves free-text card mentions to one of the user's REAL credit cards (never a fabricated id). */
export function findCardByKeyword(text: string, creditCards: CreditCard[]): CreditCard | undefined {
  const lower = text.toLowerCase();
  // prefer a specific product name match (e.g. "millennia")
  for (const card of creditCards) {
    const nameLower = card.name.toLowerCase();
    for (const aliases of Object.values(CARD_PRODUCT_KEYWORDS)) {
      if (aliases.some((a) => lower.includes(a) && nameLower.includes(a))) return card;
    }
  }
  // fall back: bank keyword + the word "card"
  if (lower.includes("card")) {
    for (const card of creditCards) {
      const haystack = `${card.name} ${card.bank}`.toLowerCase();
      for (const aliases of Object.values(BANK_KEYWORDS)) {
        if (aliases.some((a) => lower.includes(a) && haystack.includes(a))) return card;
      }
    }
    for (const card of creditCards) {
      const bankWord = card.bank.split(" ")[0].toLowerCase();
      if (bankWord.length > 2 && lower.includes(bankWord)) return card;
    }
  }
  return undefined;
}

function normalizeAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

/**
 * Resolves a masked account/card number's last 4 digits (as commonly seen
 * in bank SMS — "Card x1253", "a/c XX1234") against the user's real
 * accounts/cards by exact digit match. This is a far more reliable signal
 * than bank-name keyword matching (multiple cards from the same bank are
 * common), so callers should try this FIRST when a last-4 hint is
 * available, falling back to keyword matching only if it doesn't resolve.
 */
export function findByLastFourDigits(
  lastFour: string,
  ctx: ParserContext
): { id: string; confidence: number; isCard: boolean } | undefined {
  const digits = lastFour.replace(/\D/g, "");
  if (digits.length !== 4) return undefined;
  const card = ctx.creditCards.find((c) => c.lastFourDigits && c.lastFourDigits === digits);
  if (card) return { id: card.id, confidence: 0.97, isCard: true };
  const acc = ctx.accounts.find((a) => a.lastFourDigits && a.lastFourDigits === digits);
  if (acc) return { id: acc.id, confidence: 0.97, isCard: false };
  return undefined;
}

function normalizeBankLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Matches a masked last-4-digit reference against the user's real
 * accounts/cards, using the bank name only to disambiguate when needed —
 * per share-to-app auto-create rules, two different banks could
 * coincidentally share the same last-4 digits, so a bare last-4 match isn't
 * always enough on its own once there's more than one candidate.
 */
export function findByBankAndLastFour(
  bankName: string | null | undefined,
  lastFour: string,
  ctx: ParserContext
): { id: string; confidence: number; isCard: boolean } | undefined {
  const digits = lastFour.replace(/\D/g, "");
  if (digits.length !== 4) return undefined;

  const cardCandidates = ctx.creditCards.filter((c) => c.lastFourDigits === digits);
  const accountCandidates = ctx.accounts.filter((a) => a.lastFourDigits === digits);
  const total = cardCandidates.length + accountCandidates.length;
  if (total === 0) return undefined;

  // Unambiguous: only one real row anywhere has this last-4 — safe to use
  // even if the bank name wasn't extracted or doesn't match exactly.
  if (total === 1) {
    if (cardCandidates[0]) return { id: cardCandidates[0].id, confidence: 0.97, isCard: true };
    return { id: accountCandidates[0].id, confidence: 0.97, isCard: false };
  }

  // Multiple rows share this last-4 — the bank name is required to tell them apart.
  if (!bankName) return undefined;
  const bankNorm = normalizeBankLabel(bankName);
  const cardMatch = cardCandidates.find((c) => {
    const hay = normalizeBankLabel(`${c.bank} ${c.name}`);
    return hay.includes(bankNorm) || bankNorm.includes(normalizeBankLabel(c.bank));
  });
  if (cardMatch) return { id: cardMatch.id, confidence: 0.95, isCard: true };
  const accMatch = accountCandidates.find((a) => {
    const hay = normalizeBankLabel(`${a.bank} ${a.name}`);
    return hay.includes(bankNorm) || bankNorm.includes(normalizeBankLabel(a.bank));
  });
  if (accMatch) return { id: accMatch.id, confidence: 0.95, isCard: false };
  return undefined;
}

/** Pulls a masked-number's last 4 digits out of free text (bank SMS patterns) — e.g. "Card x1253", "a/c XX1234", "ending 4321". Digits only, no letters. */
export function extractLastFourDigits(text: string): string | undefined {
  const patterns = [
    /\b(?:card|a\/?c|account|acct)\s*(?:no\.?)?\s*[xX*]+(\d{4})\b/i,
    /\b[xX*]{2,}(\d{4})\b/,
    /\bending\s+(?:in\s+)?(\d{4})\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return undefined;
}

export function findAccount(text: string, ctx: ParserContext): { id: string; confidence: number; isCard: boolean } | undefined {
  // A masked last-4-digit reference (common in bank SMS) is a far more
  // reliable signal than a bank-name keyword — try it first.
  const lastFour = extractLastFourDigits(text);
  if (lastFour) {
    const byDigits = findByLastFourDigits(lastFour, ctx);
    if (byDigits) return byDigits;
  }

  const lower = text.toLowerCase();

  // Prefer explicit "card" mentions -> credit card, matched against the
  // user's REAL credit cards (never a hardcoded/fake id).
  if (lower.includes("card")) {
    const card = findCardByKeyword(lower, ctx.creditCards);
    if (card) return { id: card.id, confidence: 0.9, isCard: true };
  }

  const acc = findAccountByKeyword(lower, ctx.accounts);
  if (acc) return { id: acc.id, confidence: 0.85, isCard: false };

  return undefined;
}

function detectCategory(text: string, merchant: string | undefined): Category | undefined {
  const lower = text.toLowerCase();
  if (merchant) {
    const key = merchant.toLowerCase().trim();
    if (MERCHANT_CATEGORY_MAP[key]) return MERCHANT_CATEGORY_MAP[key];
    for (const [name, cat] of Object.entries(MERCHANT_CATEGORY_MAP)) {
      if (key.includes(name) || name.includes(key)) return cat;
    }
  }
  for (const [re, cat] of CATEGORY_KEYWORDS) {
    if (re.test(lower)) return cat;
  }
  return undefined;
}

function detectMerchant(text: string): string | undefined {
  // "at <Merchant> for" | "at <Merchant>" | "to <Merchant>"
  let m = text.match(
    /\bat\s+([A-Za-z][A-Za-z0-9&'.\- ]*?)(?:\s+for\b|\s+using\b|\s+from\b|\s+via\b|\s+on\b|\s+today\b|\s+yesterday\b|\s*$|,)/i
  );
  if (m) return titleCase(m[1].trim());

  // known merchant names appearing anywhere
  const lower = text.toLowerCase();
  for (const name of Object.keys(MERCHANT_CATEGORY_MAP)) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) return titleCase(name);
  }

  // "<X> bill" pattern e.g. "electricity bill"
  m = text.match(/\b([A-Za-z]+)\s+bill\b/i);
  if (m) return titleCase(m[1]);

  return undefined;
}

function titleCase(s: string): string {
  return s
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function detectType(text: string): TransactionType {
  const lower = text.toLowerCase();
  if (/credit card bill|card bill|towards.*card|pay.*card/i.test(lower) && /bill|due|outstanding/.test(lower)) {
    return "credit_card_payment";
  }
  if (/\btransferred?\b|\bmoved\b|\bsent\b.*\bfrom\b.*\bto\b/i.test(lower) && /\bfrom\b.*\bto\b/i.test(lower)) {
    return "transfer";
  }
  if (/received|credited|salary|got paid|income/i.test(lower)) return "income";
  if (/refund|reversed|cashback credited/i.test(lower)) return "refund";
  return "expense";
}

function detectTransferAccounts(text: string, ctx: ParserContext) {
  const m = text.match(/from\s+([A-Za-z ]+?)\s+to\s+([A-Za-z ]+?)(?:\.|$)/i);
  if (!m) return { from: undefined, to: undefined };
  const findByName = (name: string) => findAccountByKeyword(name, ctx.accounts)?.id;
  return { from: findByName(m[1]), to: findByName(m[2]) };
}

class RuleBasedTransactionParser implements TransactionParser {
  parse(text: string, ctx: ParserContext): ParsedTransaction {
    const trimmed = text.trim();

    // Amount: ₹1,850 | Rs 1850 | 1850 rupees | "spent 450 at ..." (bare number after a spend/receive verb)
    const amountMatch =
      trimmed.match(/(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i) ??
      trimmed.match(/([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:rupees|rs)\b/i) ??
      trimmed.match(
        /\b(?:spent|paid|received|transferred|got|bought|withdrew|refunded)\s+([0-9][0-9,]*(?:\.[0-9]{1,2})?)\b/i
      );
    const amount = amountMatch ? normalizeAmount(amountMatch[1]) : undefined;

    const transaction_type = detectType(trimmed);

    let merchant = detectMerchant(trimmed);
    let account = findAccount(trimmed, ctx);
    let transferAccounts: { from?: string; to?: string } = {};

    if (transaction_type === "transfer") {
      transferAccounts = detectTransferAccounts(trimmed, ctx);
      merchant = merchant ?? "Self Transfer";
    }

    if (transaction_type === "credit_card_payment") {
      // find the card being paid off, and the account paying from — both
      // resolved against the user's REAL rows, never a hardcoded id.
      const lower = trimmed.toLowerCase();
      const card = findCardByKeyword(lower, ctx.creditCards);
      const fromMatch = trimmed.match(/from\s+([A-Za-z ]+)/i);
      const fromAcc = fromMatch ? findAccountByKeyword(fromMatch[1], ctx.accounts) : undefined;

      account = fromAcc ? { id: fromAcc.id, confidence: 0.85, isCard: false } : undefined;
      merchant = merchant ?? "Credit Card Bill Payment";
      (transferAccounts as { cardId?: string }).cardId = card?.id;
    }

    const category = detectCategory(trimmed, merchant) ??
      (transaction_type === "income" ? "Salary" : transaction_type === "transfer" ? "Transfer" : transaction_type === "credit_card_payment" ? "Credit Card Payment" : undefined);

    const today = formatISO(new Date(), { representation: "date" });
    const dateMatch = trimmed.match(/\b(yesterday|today)\b/i);
    let transaction_date = today;
    if (dateMatch && /yesterday/i.test(dateMatch[1])) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      transaction_date = formatISO(d, { representation: "date" });
    }

    const missing_fields: string[] = [];
    if (amount === undefined) missing_fields.push("amount");
    if (transaction_type !== "transfer" && transaction_type !== "credit_card_payment" && !account) {
      missing_fields.push("account_id");
    }
    if (transaction_type === "transfer" && (!transferAccounts.from || !transferAccounts.to)) {
      missing_fields.push("account_id");
    }
    if (transaction_type === "credit_card_payment") {
      if (!(transferAccounts as { cardId?: string }).cardId) missing_fields.push("credit_card_id");
      if (!account) missing_fields.push("account_id");
    }
    if (!category) missing_fields.push("category");
    if (!merchant) missing_fields.push("merchant");

    const confidences: number[] = [];
    const field = <T,>(value: T | undefined, conf: number): { value: T | undefined; confidence: number } => {
      confidences.push(value === undefined ? 0 : conf);
      return { value, confidence: value === undefined ? 0 : conf };
    };

    const result: ParsedTransaction = {
      transaction_type: field(transaction_type, 0.85),
      amount: field(amount, amount !== undefined ? 0.95 : 0),
      merchant: field(merchant, merchant ? 0.8 : 0),
      category: field(category, category ? 0.75 : 0),
      account_id: field(
        transaction_type === "transfer" ? transferAccounts.from : account && !account.isCard ? account.id : undefined,
        account?.confidence ?? 0.7
      ),
      credit_card_id: field(
        transaction_type === "credit_card_payment"
          ? (transferAccounts as { cardId?: string }).cardId
          : account?.isCard
          ? account.id
          : undefined,
        account?.confidence ?? 0.7
      ),
      transfer_to_account_id: field(transaction_type === "transfer" ? transferAccounts.to : undefined, 0.75),
      transaction_date: field(transaction_date, dateMatch ? 0.9 : 0.6),
      raw_text: trimmed,
      missing_fields,
      overall_confidence: 0,
    };

    const relevant = confidences.filter((c) => c > 0);
    result.overall_confidence = relevant.length ? relevant.reduce((a, b) => a + b, 0) / relevant.length : 0;

    return result;
  }
}

export const transactionParser: TransactionParser = new RuleBasedTransactionParser();
