"use client";

import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useStore } from "@/lib/store/StoreContext";
import { buildSnapshot, getNetWorth, getNetWorthTrend, hasSufficientTrendData } from "@/lib/ledger/selectors";
import { useCountUp } from "@/hooks/useCountUp";
import { formatINR, cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

export function NetWorthHero() {
  const { accounts, creditCards, transactions } = useStore();
  const snap = buildSnapshot(accounts, creditCards, transactions);
  const { netWorth } = getNetWorth(snap);
  const trend = getNetWorthTrend(snap, 6);
  const enoughData = hasSufficientTrendData(snap);

  const animated = useCountUp(netWorth, 550);
  const first = trend[0]?.value ?? netWorth;
  const last = trend[trend.length - 1]?.value ?? netWorth;
  const delta = round2(last - first);
  const pct = first !== 0 ? (delta / Math.abs(first)) * 100 : 0;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  return (
    <Card className="hero-ring hero-mesh p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div>
          <span className="text-xs font-medium text-muted uppercase tracking-wide">Net Worth</span>
          <div className="money text-display text-foreground mt-1" aria-live="off">
            {formatINR(Math.round(animated))}
          </div>
          {enoughData ? (
            <div
              className={cn(
                "mt-2 inline-flex items-center gap-1.5 text-sm font-medium",
                direction === "up" ? "text-positive" : direction === "down" ? "text-negative" : "text-muted"
              )}
            >
              {direction === "up" && <TrendingUp size={15} />}
              {direction === "down" && <TrendingDown size={15} />}
              {delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${formatINR(delta)} (${pct.toFixed(1)}%)`} over 6 months
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Not enough history for a trend yet — this is your current net worth as your first data point.
            </p>
          )}
        </div>

        {enoughData && (
          <div className="h-16 w-full sm:w-48" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={direction === "down" ? "var(--negative)" : "var(--positive)"}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
