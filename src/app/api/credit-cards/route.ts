import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/apiSession";
import { listCreditCardsWithStatus, createCreditCard } from "@/lib/services/creditCardService";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireUserId();
  if ("error" in session) return session.error;

  const creditCards = await listCreditCardsWithStatus(session.userId);
  return NextResponse.json({ creditCards });
}

// Only the card name is required — we don't collect real card details.
// Everything else is optional and falls back to a generic default
// (see prisma/schema.prisma) so the credit-card ledger math still works.
const CreateSchema = z.object({
  name: z.string().min(1),
  issuer: z.string().optional(),
  lastFourDigits: z.string().regex(/^\d{4}$/, "Must be exactly 4 digits").optional(),
  creditLimit: z.number().positive().optional(),
  statementDay: z.number().int().min(1).max(28).optional(),
  paymentDueDay: z.number().int().min(1).max(28).optional(),
  openingOutstanding: z.number().optional(),
});

export async function POST(req: Request) {
  const session = await requireUserId();
  if ("error" in session) return session.error;

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const creditCard = await createCreditCard(session.userId, parsed.data);
  return NextResponse.json({ creditCard }, { status: 201 });
}
