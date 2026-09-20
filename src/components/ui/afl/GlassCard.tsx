import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The shared glass-card surface used across Home/Transactions/Accounts/
 * Credit Cards/Settings per the locked design spec: rgba(255,255,255,0.03–
 * 0.05) fill, hairline rgba(255,255,255,0.07–0.09) border, soft large-radius
 * shadow — never a sharp drop shadow. `tone="hero"` adds the violet/blue
 * gradient-mesh blooms used only on true hero elements (Total Balance,
 * account/card balance headers), per "used sparingly, only on hero cards".
 */
export function GlassCard({
  children,
  className,
  radius = 20,
  padding = "20px 20px",
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  radius?: number;
  padding?: string;
  tone?: "default" | "hero" | "flat";
}) {
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        borderRadius: radius,
        padding,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: tone === "flat" ? undefined : "var(--shadow-strong)",
      }}
    >
      {tone === "hero" && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(220px 160px at 85% -10%, rgba(156,140,255,0.30), transparent 65%)," +
              "radial-gradient(200px 160px at -10% 120%, rgba(76,134,255,0.22), transparent 65%)",
          }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
