import { redirect, notFound } from "next/navigation";
import { getAuthSession } from "@/lib/auth/auth";
import { getDashboardData } from "@/lib/services/dashboardService";
import { DashboardStoreScope } from "@/components/dashboard/DashboardStoreScope";
import { CreditCardDetail } from "@/components/creditcards/CreditCardDetail";

// Real credit card IDs are DB-generated (Prisma cuids), scoped per user —
// there's nothing to statically pre-render here.
export const dynamic = "force-dynamic";

export default async function CreditCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const data = await getDashboardData(userId);
  const card = data.creditCards.find((c) => c.id === id);
  if (!card) notFound();

  return (
    <DashboardStoreScope data={data}>
      <CreditCardDetail cardId={id} />
    </DashboardStoreScope>
  );
}
