import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/apiSession";
import { listCategories, createCategory } from "@/lib/services/categoryService";
import { ServiceError } from "@/lib/services/transactionService";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireUserId();
  if ("error" in session) return session.error;

  const categories = await listCategories(session.userId);
  return NextResponse.json({ categories });
}

const CreateSchema = z.object({ name: z.string().min(1) });

export async function POST(req: Request) {
  const session = await requireUserId();
  if ("error" in session) return session.error;

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const category = await createCategory(session.userId, parsed.data.name);
    return NextResponse.json({ category }, { status: 201 });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
