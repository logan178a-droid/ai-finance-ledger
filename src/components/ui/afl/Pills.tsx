import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small pill chip — glass background, used for account chips on the Total Balance hero and elsewhere. */
export function GlassPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5", className)}
      style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
    >
      {children}
    </div>
  );
}

/** Colored square swatch used inside account chips (bank-color-coded). */
export function ColorSwatch({ color, size = 16 }: { color: string; size?: number }) {
  return <span className="shrink-0" style={{ width: size, height: size, borderRadius: 5, background: color }} />;
}
