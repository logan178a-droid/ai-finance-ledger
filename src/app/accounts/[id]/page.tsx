import { redirect, notFound } from "next/navigation";
import { getAuthSession } from "@/lib/auth/auth";
import { getDashboardData } from "@/lib/services/dashboardService";
import { DashboardStoreScope } from "@/components/dashboard/DashboardStoreScope";
import { AccountLedgerView } from "@/components/accounts/AccountLedgerView";

// Real account IDs are DB-generated (Prisma cuids), scoped per user —
// there's nothing to statically pre-render here.
export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const data = await getDashboardData(userId);
  const account = data.accounts.find((a) => a.id === id);
  if (!account) notFound();

  return (
    <DashboardStoreScope data={data}>
      <AccountLedgerView accountId={id} />
    </DashboardStoreScope>
  );
}
