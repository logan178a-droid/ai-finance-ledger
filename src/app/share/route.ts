import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/auth";
import { classifyAndRespond } from "@/lib/ai/assistantRouter";

export const dynamic = "force-dynamic";

/**
 * Web Share Target endpoint (see `manifest.ts`'s `share_target`). Android
 * routes here with the shared text as a normal POST — a form-encoded body,
 * not a fetch the app initiates — so this receives it as a real navigation
 * and must respond with a real page (a redirect to `/share/review`), not
 * JSON. The shared text runs through the EXACT SAME `classifyAndRespond`
 * pipeline as typed/spoken capture (`/api/ai/assistant`, `/api/ai/voice`)
 * — no separate parsing logic for shared SMS.
 */
export async function POST(req: Request) {
  const session = await getAuthSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url, 303);
  }

  const form = await req.formData().catch(() => null);
  const text = (form?.get("text") as string | null)?.trim() || (form?.get("title") as string | null)?.trim() || "";

  const reviewUrl = new URL("/share/review", req.url);

  if (!text) {
    reviewUrl.searchParams.set("empty", "1");
    return NextResponse.redirect(reviewUrl, 303);
  }

  const result = await classifyAndRespond(userId, text, { autoCreateAccounts: true });

  // Small payload (a bank SMS is at most a few hundred characters) — safe
  // to round-trip through a query param rather than needing temp storage.
  const encoded = Buffer.from(JSON.stringify(result), "utf-8").toString("base64url");
  reviewUrl.searchParams.set("data", encoded);
  reviewUrl.searchParams.set("text", Buffer.from(text, "utf-8").toString("base64url"));

  return NextResponse.redirect(reviewUrl, 303);
}

// Some Android share flows (and manual testing) may hit this as a GET —
// send them to Home so it's never a dead end.
export async function GET(req: Request) {
  return NextResponse.redirect(new URL("/", req.url));
}
