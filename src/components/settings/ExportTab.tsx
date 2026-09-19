"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Mail, CheckCircle2, AlertTriangle } from "lucide-react";

type Result = { kind: "success"; email: string; count: number } | { kind: "error"; message: string } | null;

/**
 * Always sends to the account's own registered email — there's no "send
 * to" field here by design, since this is financial data and arbitrary
 * recipients would be a real security hole.
 */
export function ExportTab({ userEmail }: { userEmail: string }) {
  const [rangeMode, setRangeMode] = useState<"all" | "custom">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rangeMode === "custom" ? { from: from || undefined, to: to || undefined } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ kind: "error", message: data.message ?? data.error ?? "Couldn't send the export." });
        return;
      }
      setResult({ kind: "success", email: data.sentTo, count: data.count });
    } catch {
      setResult({ kind: "error", message: "Couldn't send the export. Please try again." });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="p-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold mb-1">Export transactions</h2>
        <p className="text-xs text-muted">
          Emails a CSV of your transactions — date, type, amount, merchant, category, account/card, and running
          balance — to <span className="font-medium text-foreground">{userEmail}</span>, your account&rsquo;s
          registered address.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-muted mb-1.5 block">Date range</label>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setRangeMode("all")}
            className={
              "flex-1 rounded-xl border px-3 py-2 text-sm transition-colors " +
              (rangeMode === "all" ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground")
            }
          >
            All transactions
          </button>
          <button
            onClick={() => setRangeMode("custom")}
            className={
              "flex-1 rounded-xl border px-3 py-2 text-sm transition-colors " +
              (rangeMode === "custom" ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground")
            }
          >
            Custom range
          </button>
        </div>
        {rangeMode === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
      </div>

      {result?.kind === "success" && (
        <div className="flex items-start gap-2 rounded-xl bg-positive-soft text-positive px-3.5 py-3 text-sm">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          <span>
            Sent to <span className="font-medium">{result.email}</span> — {result.count} transaction
            {result.count === 1 ? "" : "s"}.
          </span>
        </div>
      )}
      {result?.kind === "error" && (
        <div className="flex items-start gap-2 rounded-xl bg-negative-soft text-negative px-3.5 py-3 text-sm">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{result.message}</span>
        </div>
      )}

      <Button onClick={send} loading={sending} size="sm">
        <Mail size={14} /> Send export to my email
      </Button>
    </Card>
  );
}
