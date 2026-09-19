import React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "default" | "accent" | "ai" | "positive" | "negative" | "warning" | "confidence";

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: Variant;
  className?: string;
  /** Only for the "confidence" variant: once settled, the badge fades to a quiet, confirmed look. */
  settled?: boolean;
}

const VARIANT_CLASSES: Record<Exclude<Variant, "confidence">, string> = {
  default: "bg-background text-muted border border-border",
  accent: "bg-accent-soft text-accent",
  ai: "bg-ai-soft text-ai",
  positive: "bg-positive-soft text-positive",
  negative: "bg-negative-soft text-negative",
  warning: "bg-warning-soft text-warning",
};

export function Badge({ children, variant = "default", className, settled }: BadgeProps) {
  if (variant === "confidence") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-all duration-200 ease-out",
          settled
            ? "text-muted-soft border border-transparent"
            : "text-ai border border-dotted border-ai underline decoration-dotted underline-offset-2",
          className
        )}
      >
        {!settled && <Sparkles size={10} aria-hidden />}
        AI
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
