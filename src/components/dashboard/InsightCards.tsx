"use client";

import { useStore } from "@/lib/store/StoreContext";
import { getSpendingByCategory, getCategoryMonthOverMonthChange, getMonthSummary } from "@/lib/ledger/uiAdapters";
import { formatINR } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { TrendingUp, TrendingDown, Lightbulb } from "lucide-react";
import type { Category } from "@/lib/types";

export function InsightCards() {
  const { transactions } = useStore();
  const insights: { icon: React.ReactNode; text: string }[] = [];

  const byCategory = getSpendingByCategory(transactions, new Date());
  for (const { category } of byCategory.slice(0, 3)) {
    const change = getCategoryMonthOverMonthChange(transactions, category as Category);
    if (change.previous > 0 && Math.abs(change.pctChange) >= 10) {
      const up = change.pctChange > 0;
      insights.push({
        icon: up ? <TrendingUp size={16} className="text-danger" /> : <TrendingDown size={16} className="text-accent" />,
        text: `${category} spending is ${Math.abs(Math.round(change.pctChange))}% ${up ? "higher" : "lower"} than last month (${formatINR(change.current)} vs ${formatINR(change.previous)}).`,
      });
    }
  }

  const month = getMonthSummary(transactions);
  if (month.income > 0) {
    insights.push({
      icon: <Lightbulb size={16} className="text-accent" />,
      text:
        month.savingsRate >= 20
          ? `Great pace — you're saving ${month.savingsRate.toFixed(0)}% of income this month.`
          : `Your savings rate is ${month.savingsRate.toFixed(0)}% this month. Trimming top categories could help you hit 20%.`,
    });
  }

  if (insights.length === 0) return null;

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {insights.slice(0, 2).map((insight, i) => (
        <Card key={i} className="p-4 flex items-start gap-3">
          <div className="mt-0.5">{insight.icon}</div>
          <p className="text-sm text-foreground/90 leading-snug">{insight.text}</p>
        </Card>
      ))}
    </div>
  );
}
