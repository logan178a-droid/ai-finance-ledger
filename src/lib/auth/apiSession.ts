import { NextResponse } from "next/server";
import { getAuthSession } from "./auth";

/** Resolves the signed-in user's id for an API route, or null. Never trusts a client-supplied userId. */
export async function requireUserId(): Promise<{ userId: string } | { error: NextResponse }> {
  const session = await getAuthSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { userId };
}
