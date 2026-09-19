import { redirect } from "next/navigation";
import Link from "next/link";
import { PenLine, ArrowRight } from "lucide-react";
import { getAuthSession } from "@/lib/auth/auth";
import { getDashboardData } from "@/lib/services/dashboardService";
import { DashboardStoreScope } from "@/components/dashboard/DashboardStoreScope";
import { AssistantCapture } from "@/components/assistant/AssistantCapture";

// DB-backed page: never statically pre-rendered (middleware also guards this
// route, but force-dynamic additionally ensures no build-time DB call).
export const dynamic = "force-dynamic";

/**
 * Home — the new default landing page after login. Its entire job is "the
 * fastest possible way to log or ask something": the single merged AI input
 * (text + voice) as the clear, spacious focal point, plus one quiet link to
 * the manual-entry form. Everything else (Net Worth, charts, metrics) lives
 * on /dashboard now, one click away, not competing for attention here.
 */
export default async function HomePage() {
  const session = await getAuthSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const data = await getDashboardData(userId);

  return (
    <DashboardStoreScope data={data}>
      <div className="h-[calc(100vh-9rem)] md:h-[calc(100vh-6rem)] flex flex-col max-w-3xl mx-auto w-full">
        <div className="text-center pt-2 pb-6 shrink-0">
          <h1 className="text-h1 sm:text-display">What happened with your money?</h1>
          <p className="text-sm sm:text-base text-muted mt-2">Type it, say it, or ask a question — by voice or text.</p>
        </div>

        <div className="flex-1 min-h-0">
          <AssistantCapture />
        </div>

        <div className="shrink-0 pt-6 text-center">
          <Link
            href="/add-transaction"
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors group"
          >
            <PenLine size={14} />
            Prefer to enter it by hand?
            <span className="text-accent font-medium inline-flex items-center gap-1">
              Open the form
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </div>
    </DashboardStoreScope>
  );
}
