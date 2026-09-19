"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  className?: string;
}

/** Slide-over panel: right side on desktop, full-screen sheet on mobile. Focus-trapped, Escape closes. */
export function Drawer({ open, onClose, title, children, className }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  // Keep the latest onClose in a ref rather than the effect's dependency
  // array. A caller that defines its close handler inline (recreated every
  // render — e.g. because the drawer's own form state changes on each
  // keystroke) would otherwise cause this effect to re-run on every render,
  // re-running the "focus the first element" step below and stealing focus
  // back out of whatever field the user was actively typing in.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement;
    const node = ref.current;
    const focusable = node?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && focusable && focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      lastFocused.current?.focus();
    };
    // Intentionally only re-runs on open/close, not on every render — see
    // onCloseRef above.
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-foreground/40 animate-soft-rise" style={{ animationDuration: "150ms" }} onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className={cn(
          "glass relative h-full w-full sm:w-[420px] bg-surface-raised border-l border-border flex flex-col animate-soft-rise",
          className
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 id="drawer-title" className="text-sm font-semibold">
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close panel" className="p-1.5 rounded-md hover:bg-background text-muted">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
