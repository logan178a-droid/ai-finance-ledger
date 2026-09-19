import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { requireUserId } from "@/lib/auth/apiSession";
import { prisma } from "@/lib/prisma";
import { buildTransactionsCsv } from "@/lib/export/transactionsCsv";

export const dynamic = "force-dynamic";

const ExportSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

/**
 * Emails a CSV of the signed-in user's transactions to their REGISTERED
 * email address only — never an arbitrary address supplied in the request
 * — for the obvious reason that this is financial data. Requires
 * RESEND_API_KEY to be configured; if it isn't, this returns a clear
 * "not configured" error rather than pretending to have sent anything.
 */
export async function POST(req: Request) {
  const session = await requireUserId();
  if ("error" in session) return session.error;

  const body = await req.json().catch(() => ({}));
  const parsed = ExportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "EMAIL_NOT_CONFIGURED", message: "Email export isn't set up yet — ask the app owner to configure it." },
      { status: 503 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true, name: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { csv, count, rangeLabel } = await buildTransactionsCsv(session.userId, {
    from: parsed.data.from,
    to: parsed.data.to,
  });

  if (count === 0) {
    return NextResponse.json({ error: "No transactions found in that date range." }, { status: 400 });
  }

  const filename = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "AI Finance Ledger <onboarding@resend.dev>",
      to: user.email,
      subject: `Your transaction export (${rangeLabel})`,
      text: `Hi${user.name ? ` ${user.name}` : ""},\n\nAttached is your transaction export covering ${rangeLabel} — ${count} transaction${count === 1 ? "" : "s"} in total.\n\nThis was requested from your AI Finance Ledger account. If you didn't request this, you can ignore this email.`,
      attachments: [
        {
          filename,
          content: Buffer.from(csv, "utf-8").toString("base64"),
        },
      ],
    });

    if (error) {
      console.error("Resend send failed:", error);
      return NextResponse.json({ error: `Couldn't send the email: ${error.message}` }, { status: 502 });
    }
  } catch (err) {
    console.error("Export email failed:", err);
    return NextResponse.json({ error: "Couldn't send the email. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sentTo: user.email, count });
}
