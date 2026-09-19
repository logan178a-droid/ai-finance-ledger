"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Radio, Share2, CheckCircle2, Smartphone } from "lucide-react";

const STEPS = [
  {
    title: "Open your bank's SMS or notification",
    body: "Any transaction alert from your bank or card — a UPI payment, a debit, a credit card charge.",
  },
  {
    title: "Tap Share",
    body: "Use Android's normal Share button on the message or notification, the same way you'd share to WhatsApp.",
  },
  {
    title: "Choose AI Finance Ledger",
    body: "It'll show up in the share sheet once the app is installed (Add to Home Screen). Pick it, and the transaction is parsed and ready to confirm — no typing.",
  },
];

export function ShareSetupTab() {
  const [installed, setInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const update = () => setInstalled(mq.matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ai-soft text-ai">
            <Radio size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Share-to-app</h2>
            <p className="text-xs text-muted mt-1">
              Set this up once, and most of your transactions log themselves automatically — no typing needed.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs">
          {installed ? (
            <>
              <CheckCircle2 size={14} className="text-positive shrink-0" />
              <span className="text-positive font-medium">Installed — Share-to-app is active on this device.</span>
            </>
          ) : (
            <>
              <Smartphone size={14} className="text-muted shrink-0" />
              <span className="text-muted">
                Not installed on this device yet — open your browser menu and choose <strong className="text-foreground">Add to Home Screen</strong> (or Install App) first.
              </span>
            </>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Share2 size={14} /> How it works
        </h3>
        <ol className="space-y-3.5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ai-soft text-ai text-xs font-semibold">{i + 1}</span>
              <div>
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-xs text-muted mt-0.5">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted mt-4 pt-3 border-t border-border">
          Android only — iOS Safari doesn&rsquo;t support app-to-app sharing this way yet. On iOS, AI voice/text capture is
          the fastest option instead.
        </p>
      </Card>
    </div>
  );
}
