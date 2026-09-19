import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/apiSession";
import { updateTransaction, deleteTransaction, ServiceError } from "@/lib/services/transactionService";
import { findCategoryByName } from "@/lib/services/categoryService";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  transactionType: z.enum(["expense", "income", "transfer", "credit_card_payment", "refund"]).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().optional(),
  transactionDate: z.string().optional(),
  postingDate: z.string().nullable().optional(),
  merchant: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  // Convenience for the edit form, which only knows the category's display
  // name (e.g. "Groceries") — resolved to a categoryId server-side below.
  categoryName: z.string().nullable().optional(),
  subcategory: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  creditCardId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserId();
  if ("error" in session) return session.error;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const { categoryName, ...rest } = parsed.data;
    let categoryId = rest.categoryId;
    if (categoryId === undefined && categoryName) {
      const cat = await findCategoryByName(session.userId, categoryName);
      categoryId = cat?.id ?? null;
    }
    const transaction = await updateTransaction(session.userId, id, { ...rest, ...(categoryId !== undefined && { categoryId }) });
    return NextResponse.json({ transaction });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUserId();
  if ("error" in session) return session.error;
  const { id } = await params;

  try {
    await deleteTransaction(session.userId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
