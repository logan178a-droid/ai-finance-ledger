import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { listCategories } from "@/lib/services/categoryService";
import { listAccounts } from "@/lib/services/accountService";
import { listCreditCards } from "@/lib/services/creditCardService";
import { SettingsView } from "@/components/settings/SettingsView";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getAuthSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const [user, categories, accounts, creditCards] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, theme: true, timezone: true, createdAt: true },
    }),
    listCategories(userId),
    listAccounts(userId),
    listCreditCards(userId),
  ]);
  if (!user) redirect("/login");

  const linkedRows = [
    ...accounts.map((a) => ({ id: a.id, kind: "account" as const, name: a.name, lastFourDigits: a.lastFourDigits })),
    ...creditCards.map((c) => ({ id: c.id, kind: "card" as const, name: c.name, lastFourDigits: c.lastFourDigits })),
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <SettingsView
        initialUser={{
          id: user.id,
          email: user.email,
          name: user.name,
          theme: user.theme as "light" | "dark" | "system",
          timezone: user.timezone,
          createdAt: user.createdAt.toISOString(),
        }}
        initialCategories={categories.map((c) => ({ id: c.id, name: c.name, userId: c.userId }))}
        initialLinkedRows={linkedRows}
      />
    </div>
  );
}
