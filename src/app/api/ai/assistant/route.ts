import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/apiSession";
import { classifyAndRespond } from "@/lib/ai/assistantRouter";

export const dynamic = "force-dynamic";

const Schema = z.object({ text: z.string().min(1) });

/**
 * The single merged AI surface's text entry point: one message in, one of
 * {transaction, answer, clarify} out. See `classifyAndRespond` for the
 * actual intent routing — this route is a thin wrapper so the voice route
 * (`/api/ai/voice`) can call the exact same function after transcription.
 */
export async function POST(req: Request) {
  const session = await requireUserId();
  if ("error" in session) return session.error;

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const result = await classifyAndRespond(session.userId, parsed.data.text);
  return NextResponse.json(result);
}
