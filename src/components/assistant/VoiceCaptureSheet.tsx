"use client";

import { useEffect, useRef, useState } from "react";
import { X, Check } from "lucide-react";
import { useCaptureFlow } from "@/hooks/useCaptureFlow";
import { useToast } from "@/components/ui/Toast";
import { ConfirmationCard } from "@/components/assistant/ConfirmationCard";
import { formatINR } from "@/lib/utils";

/**
 * The voice-capture bottom sheet: tapping the Home mic button opens this
 * instead of the old always-visible inline capture card. Listening/waveform
 * state is real UI feedback (no fabricated live transcript — this app's
 * pipeline transcribes only after recording stops, so nothing is shown as
 * "live" that isn't), and once a transaction is parsed it hands off to the
 * SAME real `ConfirmationCard` used everywhere else (full editing,
 * missing-field follow-ups) — not a stripped-down duplicate that would lose
 * real functionality just to look closer to a static mockup.
 */
export function VoiceCaptureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const flow = useCaptureFlow();
  const { showToast } = useToast();
  const startedRef = useRef(false);
  const recordStartRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  useEffect(() => {
    if (open && !startedRef.current) {
      startedRef.current = true;
      recordStartRef.current = performance.now();
      setElapsedMs(null);
      flow.startRecording();
    } else if (!open && startedRef.current) {
      startedRef.current = false;
      flow.cancel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (flow.stage !== "confirmation" || recordStartRef.current === null) return;
    setElapsedMs((prev) => (prev === null ? performance.now() - recordStartRef.current! : prev));
  }, [flow.stage]);

  async function handleConfirm(final: Parameters<typeof flow.confirm>[0]) {
    const result = await flow.confirm(final);
    if (!result) return;
    const { transaction, undo } = result;
    showToast({
      message: `Logged ${formatINR(transaction.amount)} — ${transaction.description}`,
      action: { label: "Undo", onClick: undo },
    });
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto animate-soft-rise"
        style={{
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          background: "var(--surface-nav)",
          backdropFilter: "blur(var(--glass-blur-strong))",
          WebkitBackdropFilter: "blur(var(--glass-blur-strong))",
          border: "1px solid var(--border)",
          borderBottom: "none",
          padding: "10px 20px 26px",
        }}
      >
        <div className="flex justify-center pb-3">
          <span style={{ width: 36, height: 4, borderRadius: 999, background: "var(--border-strong)" }} />
        </div>

        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 p-1.5 rounded-md hover:bg-background/40 text-muted">
          <X size={16} />
        </button>

        {(flow.stage === "recording" || flow.stage === "thinking") && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="afl-label" style={{ color: "var(--accent)" }}>
              {flow.stage === "recording" ? "Listening" : "Processing"}
            </div>
            <Waveform active={flow.stage === "recording"} level={flow.recordingLevel} />
            <p className="text-sm text-muted">{flow.stage === "recording" ? "Say your transaction, or tap to stop." : "Understanding what you said…"}</p>
            {flow.stage === "recording" && (
              <button onClick={() => flow.stopRecording()} className="text-xs font-medium afl-mono" style={{ color: "var(--accent)" }}>
                Tap to stop
              </button>
            )}
          </div>
        )}

        {flow.stage === "confirmation" && flow.parsed && (
          <div className="pt-2">
            {flow.transcript && <p className="text-center text-sm text-muted italic mb-3">&ldquo;{flow.transcript}&rdquo;</p>}
            <div
              className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl"
              style={{ background: "rgba(76,134,255,0.08)", border: "1px solid rgba(76,134,255,0.22)" }}
            >
              <Check size={14} color="var(--accent)" strokeWidth={2.4} />
              <span className="text-xs font-semibold" style={{ color: "var(--accent-hover)" }}>
                Transaction detected
              </span>
            </div>
            <ConfirmationCard
              parsed={flow.parsed}
              accounts={flow.accounts}
              creditCards={flow.creditCards}
              duplicateWarning={flow.duplicateWarning}
              newAccountNote={flow.newAccountNote}
              onConfirm={handleConfirm}
              onCancel={onClose}
            />
            {elapsedMs !== null && (
              <p className="afl-label text-center mt-4">
                Processed in {(elapsedMs / 1000).toFixed(1)}s · {Math.round(flow.parsed.overall_confidence * 100)}% confidence
              </p>
            )}
          </div>
        )}

        {flow.stage === "error" && (
          <div className="py-6 text-center">
            <p className="text-sm text-negative mb-3">{flow.errorMessage}</p>
            <button onClick={onClose} className="text-xs font-medium afl-mono" style={{ color: "var(--accent)" }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Waveform({ active, level }: { active: boolean; level: number }) {
  const bars = 24;
  return (
    <div className="flex items-center gap-1" style={{ height: 44 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const base = 6 + ((i * 37) % 20);
        const boosted = active ? base + level * 24 : base * 0.4;
        return (
          <span
            key={i}
            style={{
              width: 3,
              height: Math.max(4, Math.min(44, boosted)),
              borderRadius: 2,
              background: i % 2 === 0 ? "var(--accent)" : "var(--ai)",
              opacity: active ? 0.9 : 0.35,
              transition: "height 90ms linear",
            }}
          />
        );
      })}
    </div>
  );
}
