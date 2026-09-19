import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/apiSession";
import { deleteAccount, updateAccount } from "@/lib/services/accountService";
import { ServiceError } from "@/lib/services/transactionService";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  institution: z.string().nullable().optional(),
  lastFourDigits: z.string().regex(/^\d{4}$/, "Must be exactly 4 digits").or(z.literal("")).optional(),
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
    const account = await updateAccount(session.userId, id, parsed.data);
    return NextResponse.json({ account });
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
    await deleteAccount(session.userId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
