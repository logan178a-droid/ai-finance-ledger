import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/auth";
import { getDashboardData } from "@/lib/services/dashboardService";
import { DashboardStoreScope } from "@/components/dashboard/DashboardStoreScope";
import { NetWorthHero } from "@/components/dashboard/NetWorthHero";
import { TierTwoMetrics } from "@/components/dashboard/TierTwoMetrics";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { CategoryChart } from "@/components/dashboard/CategoryChart";
import { InsightCards } from "@/components/dashboard/InsightCards";

// DB-backed page: never statically pre-rendered (middleware also guards this
// route, but force-dynamic additionally ensures no build-time DB call).
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getAuthSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const data = await getDashboardData(userId);

  return (
    <DashboardStoreScope data={data}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted mt-1">Your financial overview, at a glance.</p>
        </div>

        {/* Tier 1: net worth */}
        <NetWorthHero />

        {/* Tier 2: distinct position cards, month summary, upcoming dues */}
        <TierTwoMetrics />

        {/* Tier 3: below the fold — category breakdown, recent activity, AI insights */}
        <div className="grid lg:grid-cols-2 gap-4">
          <CategoryChart />
          <RecentTransactions />
        </div>

        <InsightCards />
      </div>
    </DashboardStoreScope>
  );
}
