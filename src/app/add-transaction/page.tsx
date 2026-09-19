import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/auth";
import { getDashboardData } from "@/lib/services/dashboardService";
import { DashboardStoreScope } from "@/components/dashboard/DashboardStoreScope";
import { AddTransactionForm } from "@/components/dashboard/AddTransactionForm";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function AddTransactionPage() {
  const session = await getAuthSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const data = await getDashboardData(userId);

  return (
    <DashboardStoreScope data={data}>
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Add Transaction</h1>
          <p className="text-sm text-muted mt-1">Enter the details by hand, field by field.</p>
        </div>
        <Card className="p-5 sm:p-6">
          <AddTransactionForm />
        </Card>
      </div>
    </DashboardStoreScope>
  );
}
