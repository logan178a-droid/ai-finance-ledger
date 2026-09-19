import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/auth";
import { getDashboardData } from "@/lib/services/dashboardService";
import { DashboardStoreScope } from "@/components/dashboard/DashboardStoreScope";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const session = await getAuthSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const data = await getDashboardData(userId);

  return (
    <DashboardStoreScope data={data}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted mt-1">Every transaction in your ledger, computed from your real account history.</p>
        </div>
        <TransactionsTable />
      </div>
    </DashboardStoreScope>
  );
}
