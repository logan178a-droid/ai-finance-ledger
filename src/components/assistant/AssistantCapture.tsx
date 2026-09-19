"use client";

import { useEffect, useRef, useState } from "react";
import { Check, AlertTriangle, ArrowRight, Mic, Square, X, Sparkles, User } from "lucide-react";
import { useCaptureFlow, type AssistantApiResult } from "@/hooks/useCaptureFlow";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { AICaptureInput } from "@/components/ui/AICaptureInput";
import { ConfirmationCard } from "@/components/assistant/ConfirmationCard";
import { formatINR, cn } from "@/lib/utils";

const PLACEHOLDER_EXAMPLES = [
  'Spent ₹850 at Reliance for groceries using HDFC card',
  'How much did I spend on food this month?',
  'Paid ₹1,200 electricity bill from SBI',
  'What do I owe on my credit cards?',
];

// Voice-originated errors get a "Try again" that re-opens the mic directly,
// since the user was already mid-voice-flow — everything else resets to idle.
const VOICE_ERROR_KINDS = new Set(["voice-permission", "voice-no-mic", "voice-no-speech", "voice-transcription", "voice-not-configured"]);

/**
 * The single merged AI surface: one input (text or voice) that handles both
 * "log a transaction" and "ask a question about my finances" — the server
 * decides which per message (`classifyAndRespond`). Transaction intent flows
 * into the confirmation card exactly as before; question intent appends a
 * conversational exchange to `flow.messages` and hands the input right back.
 *
 * Stage machine: idle -> input|recording -> thinking -> confirmation ->
 * saving -> success | error. "answered" isn't a separate stage — it folds
 * straight back to idle with the Q&A appended to the message log.
 */
export function AssistantCapture({
  initialExternal,
}: {
  /** Lets an external source (e.g. the `/share` route, receiving a shared bank SMS) hand off an already-classified result to land directly on the confirmation card — no separate UI pattern. */
  initialExternal?: { result: AssistantApiResult; rawText: string };
} = {}) {
  const flow = useCaptureFlow();
  const reducedMotion = usePrefersReducedMotion();
  const { showToast } = useToast();
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [focused, setFocused] = useState(false);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const loadedExternalRef = useRef(false);

  useEffect(() => {
    if (!initialExternal || loadedExternalRef.current) return;
    loadedExternalRef.current = true;
    flow.loadExternal(initialExternal.result, initialExternal.rawText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialExternal]);

  // Rotate placeholder examples, paused on focus/typing and under reduced motion.
  useEffect(() => {
    if (reducedMotion || focused || flow.text) return;
    const id = setInterval(() => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_EXAMPLES.length), 3200);
    return () => clearInterval(id);
  }, [reducedMotion, focused, flow.text]);

  // Announce stage transitions for screen readers.
  useEffect(() => {
    if (!liveRegionRef.current) return;
    const messages: Partial<Record<string, string>> = {
      recording: "Listening.",
      thinking: "Understanding…",
      confirmation: "Transaction understood. Please review and confirm.",
      saving: "Saving transaction.",
      success: "Saved.",
      error: "Couldn't process that.",
    };
    const msg = messages[flow.stage];
    if (msg) liveRegionRef.current.textContent = msg;
  }, [flow.stage]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  }, [flow.messages.length, reducedMotion]);

  async function handleConfirm(final: Parameters<typeof flow.confirm>[0]) {
    const result = await flow.confirm(final);
    if (!result) return;
    const { transaction, undo } = result;
    const verb = transaction.transaction_type === "income" ? "Added income of" : transaction.transaction_type === "expense" ? "Added expense of" : "Logged";
    showToast({
      message: `${verb} ${formatINR(transaction.amount)} — ${transaction.description}`,
      action: { label: "Undo", onClick: undo },
    });
  }

  function handleErrorRetry() {
    if (VOICE_ERROR_KINDS.has(flow.errorKind ?? "")) {
      flow.retry();
      flow.startRecording();
    } else {
      flow.retry();
    }
  }

  return (
    <Card className="relative overflow-visible flex flex-col h-full min-h-0 p-6 sm:p-8">
      <div ref={liveRegionRef} aria-live="polite" className="sr-only" />

      {flow.messages.length > 0 && (
        <div className="flex-1 min-h-0 space-y-3 mb-4 overflow-y-auto pr-1">
          {flow.messages.map((m) => (
            <div key={m.id} className={cn("flex items-start gap-2", m.role === "user" && "flex-row-reverse")}>
              <div
                className={cn(
                  "h-6 w-6 shrink-0 rounded-full flex items-center justify-center",
                  m.role === "assistant" ? "bg-ai-soft text-ai" : "bg-background text-muted"
                )}
                aria-hidden
              >
                {m.role === "assistant" ? <Sparkles size={12} /> : <User size={12} />}
              </div>
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                  m.role === "assistant" ? "bg-ai-soft text-foreground" : "bg-background text-foreground"
                )}
              >
                {m.text}
              </div>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}

      {(flow.stage === "idle" || flow.stage === "input" || flow.stage === "success") && (
        <div className={cn("flex-1 min-h-0 flex flex-col justify-center", flow.messages.length > 0 && "flex-none")}>
          {flow.stage === "success" && (
            <div className="flex items-center gap-2 text-positive mb-4 animate-soft-rise" aria-hidden>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-positive-soft">
                <Check size={12} />
              </span>
              <p className="text-xs font-medium">Saved. Ready for the next one.</p>
            </div>
          )}
          <AICaptureInput
            value={flow.text}
            onChange={flow.setText}
            onSubmit={() => flow.submit()}
            onFocus={() => {
              setFocused(true);
              flow.focusInput();
            }}
            onBlur={() => setFocused(false)}
            placeholder={`e.g. "${PLACEHOLDER_EXAMPLES[placeholderIdx]}"`}
            onMicClick={flow.startRecording}
            size="hero"
          />
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            {PLACEHOLDER_EXAMPLES.map((s) => (
              <button
                key={s}
                onClick={() => flow.submit(s)}
                className="text-xs px-3.5 py-1.5 rounded-full border border-border text-muted hover:text-foreground hover:border-ai/50 hover:bg-ai-soft/40 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {flow.stage === "recording" && (
        <div className="flex-1 min-h-0 py-5 flex flex-col items-center justify-center gap-5">
          <button
            type="button"
            onClick={flow.stopRecording}
            aria-label="Stop recording"
            className="relative flex h-20 w-20 items-center justify-center rounded-full bg-ai text-ai-foreground shadow-[0_0_50px_-8px_var(--ai)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai/40"
          >
            {!reducedMotion && (
              <span
                className="absolute inset-0 rounded-full bg-ai/35"
                style={{ transform: `scale(${1 + flow.recordingLevel * 0.7})`, transition: "transform 80ms linear" }}
                aria-hidden
              />
            )}
            <Square size={22} className="relative fill-current" />
          </button>
          <div className="text-center">
            <p className="text-base font-semibold text-ai">Listening…</p>
            <p className="text-sm text-muted mt-1">Tap to stop, or pause and it&rsquo;ll stop on its own.</p>
          </div>
          <button
            type="button"
            onClick={flow.cancelRecording}
            className="text-xs font-medium text-muted hover:text-foreground inline-flex items-center gap-1"
          >
            <X size={12} /> Cancel
          </button>
        </div>
      )}

      {flow.stage === "thinking" && (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3">
          <span className={cn("h-3 w-3 rounded-full bg-ai shadow-[0_0_16px_-2px_var(--ai)]", !reducedMotion && "animate-breathe")} aria-hidden />
          <p className="text-sm text-muted">Understanding…</p>
        </div>
      )}

      {(flow.stage === "confirmation" || flow.stage === "saving") && flow.parsed && (
        <>
          {flow.transcript && (
            <p className="text-xs text-muted mb-3 flex items-center gap-1.5">
              <Mic size={11} className="text-ai" /> Heard: &ldquo;{flow.transcript}&rdquo;
            </p>
          )}
          <ConfirmationCard
            parsed={flow.parsed}
            accounts={flow.accounts}
            creditCards={flow.creditCards}
            duplicateWarning={flow.duplicateWarning}
            newAccountNote={flow.newAccountNote}
            onConfirm={handleConfirm}
            onCancel={flow.cancel}
          />
        </>
      )}

      {flow.stage === "error" && (
        <div className="py-4">
          <div className="flex items-start gap-2 rounded-xl bg-negative-soft text-negative px-3.5 py-3 text-sm mb-3">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{flow.errorMessage}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {flow.errorKind !== "voice-permission" && (
              <button
                onClick={handleErrorRetry}
                className="text-xs font-medium px-3 py-2 rounded-lg border border-border hover:bg-background transition-colors inline-flex items-center gap-1.5"
              >
                Try again <ArrowRight size={12} />
              </button>
            )}
            {flow.errorKind === "voice-permission" && (
              <a
                href="https://support.google.com/chrome/answer/2693767"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium px-3 py-2 rounded-lg border border-border hover:bg-background transition-colors"
              >
                How to enable microphone access
              </a>
            )}
            {(VOICE_ERROR_KINDS.has(flow.errorKind ?? "") || flow.errorKind === "voice-permission") && (
              <button
                onClick={flow.retry}
                className="text-xs font-medium px-3 py-2 rounded-lg border border-ai/40 text-ai hover:bg-ai-soft transition-colors"
              >
                Type it instead
              </button>
            )}
            {(flow.errorKind === "route" || flow.errorKind === "save") && (
              <a
                href="/transactions"
                className="text-xs font-medium px-3 py-2 rounded-lg border border-ai/40 text-ai hover:bg-ai-soft transition-colors"
              >
                Enter manually instead
              </a>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
