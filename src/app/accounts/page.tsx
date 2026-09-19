import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/auth";
import { getDashboardData } from "@/lib/services/dashboardService";
import { DashboardStoreScope } from "@/components/dashboard/DashboardStoreScope";
import { AccountsView } from "@/components/accounts/AccountsView";

// DB-backed page: never statically pre-rendered (middleware also guards this
// route, but force-dynamic additionally ensures no build-time DB call).
export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const session = await getAuthSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const data = await getDashboardData(userId);

  return (
    <DashboardStoreScope data={data}>
      <AccountsView />
    </DashboardStoreScope>
  );
}
