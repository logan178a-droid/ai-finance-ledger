import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/apiSession";
import { listAccountsWithBalances, createAccount } from "@/lib/services/accountService";
import { ServiceError } from "@/lib/services/transactionService";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireUserId();
  if ("error" in session) return session.error;

  const accounts = await listAccountsWithBalances(session.userId);
  return NextResponse.json({ accounts });
}

const CreateSchema = z.object({
  type: z.enum(["bank", "cash", "investment"]),
  name: z.string().min(1),
  institution: z.string().nullable().optional(),
  openingBalance: z.number().optional(),
  currency: z.string().optional(),
  lastFourDigits: z.string().regex(/^\d{4}$/, "Must be exactly 4 digits").optional(),
});

export async function POST(req: Request) {
  const session = await requireUserId();
  if ("error" in session) return session.error;

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const account = await createAccount(session.userId, parsed.data);
    return NextResponse.json({ account }, { status: 201 });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("Failed to create account:", e);
    return NextResponse.json({ error: "Couldn't save that account. Please try again." }, { status: 500 });
  }
}
