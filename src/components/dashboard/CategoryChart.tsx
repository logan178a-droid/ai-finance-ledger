"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { useStore } from "@/lib/store/StoreContext";
import { buildSnapshot, getSpendingByCategory } from "@/lib/ledger/selectors";
import { formatINR } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";

const BAR_COLOR = "var(--accent)";

export function CategoryChart() {
  const { accounts, creditCards, transactions } = useStore();
  const snap = buildSnapshot(accounts, creditCards, transactions);
  const data = getSpendingByCategory(snap, new Date()).slice(0, 8);
  const height = Math.max(160, data.length * 36);

  return (
    <Card>
      <CardHeader title="Spending by Category" subtitle="This month, ranked" />
      <div className="px-5 pb-5 pt-2">
        {data.length === 0 ? (
          <p className="text-sm text-muted py-10 text-center">No spending yet this month.</p>
        ) : (
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={110}
                  tick={{ fontSize: 12, fill: "var(--muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--background)" }}
                  formatter={(v) => formatINR(Number(v))}
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }}
                />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={20}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={BAR_COLOR} fillOpacity={1 - i * 0.08} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
