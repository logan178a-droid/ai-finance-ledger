import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/auth";
import { getDashboardData } from "@/lib/services/dashboardService";
import { DashboardStoreScope } from "@/components/dashboard/DashboardStoreScope";
import { CreditCardsListView } from "@/components/creditcards/CreditCardsListView";

export const dynamic = "force-dynamic";

export default async function CreditCardsPage() {
  const session = await getAuthSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const data = await getDashboardData(userId);

  return (
    <DashboardStoreScope data={data}>
      <CreditCardsListView />
    </DashboardStoreScope>
  );
}
