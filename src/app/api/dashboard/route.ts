import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/apiSession";
import { getDashboardData } from "@/lib/services/dashboardService";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireUserId();
  if ("error" in session) return session.error;

  const data = await getDashboardData(session.userId);
  return NextResponse.json(data);
}
