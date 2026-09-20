import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Uppercase mono micro-label — "TOTAL BALANCE", "TODAY", field labels in the expanded transaction card, etc. */
export function MonoLabel({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={cn("afl-label", className)} style={style}>
      {children}
    </div>
  );
}

/** Plain (non-uppercase) mono text — chip figures, timestamps, "See all" links. */
export function Mono({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span className={cn("afl-mono", className)} style={style}>
      {children}
    </span>
  );
}
