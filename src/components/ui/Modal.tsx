"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

/** Centered focus-trapped dialog — reserved for destructive confirmations. */
export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  // See Drawer.tsx for why onClose is read via a ref instead of being a
  // dependency here — an inline/unmemoized onClose from the caller would
  // otherwise re-run this effect (and re-steal focus) on every render.
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
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/40 animate-soft-rise"
        style={{ animationDuration: "150ms" }}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? "modal-description" : undefined}
        className={cn(
          "glass relative w-full max-w-sm rounded-2xl bg-surface-raised border border-border p-5 animate-soft-rise",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 id="modal-title" className="text-sm font-semibold">
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close dialog" className="p-1 rounded-md hover:bg-background text-muted">
            <X size={16} />
          </button>
        </div>
        {description && (
          <p id="modal-description" className="text-sm text-muted mb-4">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
