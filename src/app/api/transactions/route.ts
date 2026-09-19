import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/apiSession";
import { createTransaction, listTransactions, ServiceError } from "@/lib/services/transactionService";
import { findCategoryByName } from "@/lib/services/categoryService";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  transactionType: z.enum(["expense", "income", "transfer", "credit_card_payment", "refund"]),
  amount: z.number().positive(),
  currency: z.string().optional(),
  transactionDate: z.string(),
  postingDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  merchant: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  // Convenience for AI-capture callers that only know the category's display
  // name (e.g. "Groceries") — resolved to a categoryId server-side below.
  categoryName: z.string().nullable().optional(),
  subcategory: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  creditCardId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  source: z.enum(["manual", "ai_text", "ai_voice", "ai_share"]).optional(),
  aiConfidence: z.unknown().optional(),
});

export async function GET() {
  const session = await requireUserId();
  if ("error" in session) return session.error;

  const transactions = await listTransactions(session.userId);
  return NextResponse.json({ transactions });
}

export async function POST(req: Request) {
  const session = await requireUserId();
  if ("error" in session) return session.error;

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const { categoryName, ...rest } = parsed.data;
    let categoryId = rest.categoryId ?? null;
    if (!categoryId && categoryName) {
      const cat = await findCategoryByName(session.userId, categoryName);
      categoryId = cat?.id ?? null;
    }
    const transaction = await createTransaction(session.userId, { ...rest, categoryId });
    return NextResponse.json({ transaction }, { status: 201 });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
