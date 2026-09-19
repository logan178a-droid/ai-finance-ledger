import type OpenAI from "openai";
import { getOpenAIClient } from "@/lib/ai/openaiClient";
import { resolveTransactionText, type ResolveTransactionResult } from "@/lib/ai/resolveTransaction";
import { getDashboardData } from "@/lib/services/dashboardService";
import {
  get_spending_summary,
  get_credit_card_status,
  get_net_worth,
  get_account_balance,
  search_transactions,
  get_month_summary,
  answerQuestion as regexAnswerQuestion,
  type QueryContext,
} from "@/lib/ai/queryEngine";
import { transactionParser, KNOWN_CATEGORIES } from "@/lib/ai/parseTransaction";
import type { Category } from "@/lib/types";

/**
 * The single entry point for the merged AI surface: one function that both
 * the typed-text route and the voice route call with plain text (the voice
 * route's only extra step is transcription ahead of this) — there is no
 * separate intent/response pipeline for voice vs text, per the merge.
 *
 * Classifies the message into exactly one of three outcomes using the LLM
 * itself (never rigid keyword matching, so typos/broken grammar/Hinglish
 * still route correctly):
 *   - "transaction": something happened with money → re-uses the EXISTING,
 *     already-tested `resolveTransactionText` (the same function the old
 *     text-capture path used) to produce the structured, confirmable
 *     transaction. No duplicated extraction logic.
 *   - "answer": a question about their existing finances → routes to the
 *     EXISTING, already-tested query functions in `queryEngine.ts` (the same
 *     ones the old /assistant chat page used), which compute the answer for
 *     real from the signed-in user's actual database rows — the LLM only
 *     picks which function to call and with what arguments, never states a
 *     number itself.
 *   - "clarify": genuinely ambiguous (not just imperfect phrasing) → a short
 *     conversational clarifying question, never a cold "couldn't parse" error.
 */

export type AssistantResult =
  | ({ kind: "transaction" } & ResolveTransactionResult)
  | { kind: "answer"; message: string }
  | { kind: "clarify"; message: string };

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "log_transaction",
      description:
        "The message describes or implies something that happened with the user's money — an expense, income, transfer between their own accounts, credit card bill payment, or refund. Use this even for casual, ungrammatical, or incomplete phrasing, typos, or Hindi/English mixing — e.g. 'reliance 500 today', 'spent 500 at reliance', 'paid electricity bill from sbi', 'kal 200 rupaye diye uber ko', '500 hdfc card se'. A bare amount with a merchant/place/purpose, even without a verb, still counts.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "answer_question",
      description:
        "The message is asking about the user's EXISTING recorded finances — past spending, balances, dues, net worth, savings — not describing a new transaction. Use this even for casual phrasing, typos, or Hindi/English mixing — e.g. 'kitna kharch hua is mahine', 'how much did i spend on food', 'what do i owe', 'balance kya hai', 'net worth?'.",
      parameters: {
        type: "object",
        properties: {
          question_type: {
            type: "string",
            enum: ["spending_summary", "credit_card_status", "net_worth", "account_balance", "search_transactions", "month_summary"],
            description:
              "spending_summary: how much spent overall or in a category. credit_card_status: card dues/outstanding. net_worth: overall net worth. account_balance: a specific or all account balances. search_transactions: find past transactions matching a merchant/keyword. month_summary: income vs expense vs savings this month.",
          },
          category: {
            type: "string",
            description: "If asking about spending in a specific category (e.g. groceries, food, fuel), the category name as stated. Omit otherwise.",
          },
          search_query: {
            type: "string",
            description: "For search_transactions or account_balance: the merchant name, account name, or keyword to search/match. Omit otherwise.",
          },
        },
        required: ["question_type"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_clarification",
      description:
        "Use ONLY when the message is genuinely ambiguous between logging a transaction and asking a question, or has essentially no interpretable financial content at all (e.g. a bare number with zero context, or unrelated small talk). Do NOT use this for imperfect grammar, typos, or informal phrasing — interpret those with the other two tools instead.",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "A short, friendly, specific clarifying question or response to show the user, always written in English regardless of what language the user's message was in.",
          },
        },
        required: ["message"],
        additionalProperties: false,
      },
    },
  },
];

const SYSTEM_PROMPT =
  `You are the intent router for an Indian personal finance app. The app currently supports English only. Every message is either (1) describing a money transaction that just happened, (2) asking a question about the user's existing recorded finances, or (3) genuinely unclear. Call exactly one tool. ` +
  `Input may be messy: typos, missing verbs, filler words ("um", "like"), incomplete sentences. Be lenient — infer the most likely meaning rather than defaulting to clarification. Only use ask_clarification when there is truly not enough signal to tell which of the two it is, or no financial content at all — never merely because the phrasing is imperfect. ` +
  `Always respond in English only, regardless of what language any part of the message was in.`;

function resolveCategoryArg(raw?: string): Category | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase().trim();
  const exact = KNOWN_CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;
  const partial = KNOWN_CATEGORIES.find((c) => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase().split(" ")[0]));
  return partial;
}

function runQuery(ctx: QueryContext, type: string, args: { category?: string; search_query?: string }): string {
  switch (type) {
    case "spending_summary":
      return get_spending_summary(ctx, resolveCategoryArg(args.category));
    case "credit_card_status":
      return get_credit_card_status(ctx);
    case "net_worth":
      return get_net_worth(ctx);
    case "account_balance":
      return get_account_balance(ctx, args.search_query ?? "");
    case "search_transactions":
      return search_transactions(ctx, args.search_query ?? "");
    case "month_summary":
      return get_month_summary(ctx);
    default:
      return "I can answer questions about spending by category, credit card dues, account balances, net worth, and monthly cash flow.";
  }
}

/** No-OPENAI_API_KEY fallback: a coarse heuristic so the surface still functions, clearly a safety net rather than the primary (LLM-routed) path. */
async function fallbackRoute(userId: string, text: string, opts: { autoCreateAccounts?: boolean }): Promise<AssistantResult> {
  const lower = text.toLowerCase();
  const looksLikeQuestion = /\b(how much|what'?s|do i owe|balance|net worth|spent|spending|kharch|kitna)\b/i.test(lower) && /\?|how|what|do i|kitna/i.test(lower);
  const regexParsed = transactionParser.parse(text, { accounts: [], creditCards: [] });
  const looksLikeTransaction = regexParsed.amount.value !== undefined && !looksLikeQuestion;

  if (looksLikeTransaction) {
    const result = await resolveTransactionText(userId, text, opts);
    return { kind: "transaction", ...result };
  }
  if (looksLikeQuestion) {
    const data = await getDashboardData(userId);
    return { kind: "answer", message: regexAnswerQuestion({ accounts: data.accounts, creditCards: data.creditCards, transactions: data.transactions }, text) };
  }
  return { kind: "clarify", message: "I'm not sure if that's something you spent or a question — could you say a bit more?" };
}

export async function classifyAndRespond(
  userId: string,
  text: string,
  opts: { autoCreateAccounts?: boolean } = {}
): Promise<AssistantResult> {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackRoute(userId, text, opts);
  }

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      tools: TOOLS,
      tool_choice: "required",
      temperature: 0,
    });

    const call = completion.choices[0]?.message.tool_calls?.[0];
    if (!call || call.type !== "function") return fallbackRoute(userId, text, opts);

    const args = JSON.parse(call.function.arguments || "{}") as {
      question_type?: string;
      category?: string;
      search_query?: string;
      message?: string;
    };

    if (call.function.name === "log_transaction") {
      const result = await resolveTransactionText(userId, text, opts);
      return { kind: "transaction", ...result };
    }

    if (call.function.name === "answer_question") {
      const data = await getDashboardData(userId);
      const ctx: QueryContext = { accounts: data.accounts, creditCards: data.creditCards, transactions: data.transactions };
      const message = runQuery(ctx, args.question_type ?? "", args);
      return { kind: "answer", message };
    }

    return { kind: "clarify", message: args.message ?? "I'm not sure if that's something you spent or a question — could you say a bit more?" };
  } catch (err) {
    console.error("Intent classification failed, falling back:", err);
    return fallbackRoute(userId, text, opts);
  }
}
