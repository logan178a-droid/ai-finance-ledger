"use client";

import React, { forwardRef } from "react";
import { Sparkles, Mic, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AICaptureInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onMicClick?: () => void;
  listening?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** "hero" is the large, confident treatment for the Home page — the app's single most striking element. */
  size?: "default" | "hero";
}

/** The shared AI-accent capture affordance — violet border/ring, distinct from primary-accent controls. */
export const AICaptureInput = forwardRef<HTMLInputElement, AICaptureInputProps>(function AICaptureInput(
  { value, onChange, onSubmit, placeholder, onFocus, onBlur, onMicClick, listening, disabled, autoFocus, size = "default" },
  ref
) {
  const hero = size === "hero";
  return (
    <div
      className={cn(
        "glass hero-ring ai-glow-focus flex items-center transition-shadow duration-200",
        "border border-ai/25 bg-ai-soft",
        hero ? "gap-3 rounded-3xl px-5 py-4 sm:px-6 sm:py-5" : "gap-2 rounded-2xl px-3 py-2.5"
      )}
    >
      <Sparkles size={hero ? 22 : 18} className="text-ai shrink-0" aria-hidden />
      <input
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder ?? 'Tell me what happened with your money…'}
        aria-label="Describe a transaction in plain English"
        className={cn(
          "flex-1 min-w-0 bg-transparent outline-none placeholder:text-muted-soft truncate",
          hero ? "text-base sm:text-lg font-medium" : "text-sm"
        )}
      />
      {onMicClick && (
        <button
          type="button"
          onClick={onMicClick}
          aria-label="Voice input"
          className={cn(
            "shrink-0 rounded-full flex items-center justify-center text-ai-foreground bg-ai transition-all duration-200",
            "hover:bg-ai-hover hover:shadow-[0_0_24px_-4px_var(--ai)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai/40",
            hero ? "h-14 w-14 sm:h-16 sm:w-16" : "min-h-[44px] min-w-[44px] p-2.5 bg-transparent text-ai hover:bg-ai-soft hover:shadow-none",
            listening && "animate-breathe shadow-[0_0_24px_-4px_var(--ai)]"
          )}
        >
          <Mic size={hero ? 24 : 18} />
        </button>
      )}
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        aria-label="Submit transaction"
        className={cn(
          "shrink-0 rounded-full bg-ai text-ai-foreground flex items-center justify-center transition-all duration-200",
          "disabled:opacity-40 hover:bg-ai-hover hover:shadow-[0_0_24px_-4px_var(--ai)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai/40",
          hero ? "h-14 w-14 sm:h-16 sm:w-16" : "min-h-[44px] min-w-[44px] p-2.5"
        )}
      >
        <ArrowRight size={hero ? 22 : 18} />
      </button>
    </div>
  );
});
