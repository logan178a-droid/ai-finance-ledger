import { redirect } from "next/navigation";
import { getDaysInMonth } from "date-fns";
import { getAuthSession } from "@/lib/auth/auth";
import { getDashboardData } from "@/lib/services/dashboardService";
import { DashboardStoreScope } from "@/components/dashboard/DashboardStoreScope";
import { HomeView } from "@/components/dashboard/HomeView";

// DB-backed page: never statically pre-rendered (middleware also guards this
// route, but force-dynamic additionally ensures no build-time DB call).
export const dynamic = "force-dynamic";

/**
 * Home — the app's primary screen per the locked design spec: balance hero,
 * Share-to-app status, voice capture entry point, and recent activity, all
 * real data from the signed-in user's actual ledger.
 */
export default async function HomePage() {
  const session = await getAuthSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const data = await getDashboardData(userId);

  const rawName = session?.user?.name || session?.user?.email?.split("@")[0] || "there";
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  const now = new Date();
  const daysLeft = getDaysInMonth(now) - now.getDate();
  const monthName = now.toLocaleDateString("en-IN", { month: "long" });
  const daysLeftLabel = daysLeft === 0 ? `Last day of ${monthName}` : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in ${monthName}`;

  return (
    <DashboardStoreScope data={data}>
      <HomeView name={name} daysLeftLabel={daysLeftLabel} />
    </DashboardStoreScope>
  );
}
