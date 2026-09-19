"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/Card";
import { useCountUp } from "@/hooks/useCountUp";
import { formatINR, cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  /** Static display string — used as-is, no animation. */
  value?: string;
  /** Animated alternative to `value`: counts up/down on change and is formatted as INR. */
  numericValue?: number;
  icon?: React.ReactNode;
  delta?: { value: string; direction: "up" | "down" | "flat"; tone?: "positive" | "negative" | "neutral" };
  sparkline?: number[];
  tone?: "default" | "danger" | "accent";
  className?: string;
}

export function MetricCard({ label, value, numericValue, icon, delta, sparkline, tone = "default", className }: MetricCardProps) {
  const sparkData = sparkline?.map((v, i) => ({ i, v }));
  const animated = useCountUp(numericValue ?? 0, 550);
  const displayValue = numericValue !== undefined ? formatINR(Math.round(animated)) : value ?? "";

  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-medium text-muted">{label}</span>
        {icon && (
          <span className={cn(tone === "danger" ? "text-danger" : tone === "accent" ? "text-accent" : "text-muted")}>
            {icon}
          </span>
        )}
      </div>
      <div
        className={cn(
          "money text-2xl sm:text-3xl font-bold tracking-tight",
          tone === "danger" ? "text-danger" : "text-foreground"
        )}
      >
        {displayValue}
      </div>
      <div className="flex items-center justify-between mt-2 gap-2">
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              delta.tone === "positive"
                ? "text-positive"
                : delta.tone === "negative"
                ? "text-negative"
                : "text-muted"
            )}
          >
            {delta.direction === "up" && <TrendingUp size={13} aria-hidden />}
            {delta.direction === "down" && <TrendingDown size={13} aria-hidden />}
            {delta.value}
          </span>
        ) : (
          <span />
        )}
        {sparkData && sparkData.length > 1 && (
          <div className="h-7 w-16" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke="var(--accent)"
                  strokeWidth={1.75}
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
