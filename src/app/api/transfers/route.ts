import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/apiSession";
import { createTransfer, ServiceError } from "@/lib/services/transactionService";

export const dynamic = "force-dynamic";

const TransferSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().optional(),
  transactionDate: z.string(),
  fromAccountId: z.string(),
  toAccountId: z.string(),
  notes: z.string().nullable().optional(),
  source: z.enum(["manual", "ai_text", "ai_voice", "ai_share"]).optional(),
});

export async function POST(req: Request) {
  const session = await requireUserId();
  if ("error" in session) return session.error;

  const body = await req.json().catch(() => null);
  const parsed = TransferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const result = await createTransfer(session.userId, parsed.data);
    return NextResponse.json({ transfer: result }, { status: 201 });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
