"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useStore } from "@/lib/store/StoreContext";
import { cn } from "@/lib/utils";
import type { CreditCard } from "@/lib/types";

const COMMON_ISSUERS = [
  "HDFC Bank",
  "ICICI Bank",
  "SBI Card",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "American Express",
  "IDFC FIRST Bank",
  "Yes Bank",
  "RBL Bank",
  "IndusInd Bank",
];

const NETWORKS = ["Visa", "Mastercard", "RuPay", "Amex"] as const;

/** Only a name + (optional) issuer/network/last-4 — we don't collect real card numbers/limits/dates. */
export function AddCreditCardDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { addCreditCard } = useStore();
  const [issuer, setIssuer] = useState("");
  const [name, setName] = useState("");
  const [network, setNetwork] = useState<(typeof NETWORKS)[number] | "">("");
  const [lastFour, setLastFour] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setIssuer("");
    setName("");
    setNetwork("");
    setLastFour("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Nickname optional — falls back to "<Issuer> Card" so the required-name
    // rule never blocks submission just because the user skipped naming it.
    const finalName = name.trim() || (issuer.trim() ? `${issuer.trim()} Card` : "");
    if (!finalName) {
      setError("Enter a card issuer or a nickname.");
      return;
    }
    if (lastFour && !/^\d{4}$/.test(lastFour)) {
      setError("Last 4 digits must be exactly 4 numbers, or left blank.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/credit-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalName,
          issuer: issuer.trim() || undefined,
          lastFourDigits: lastFour || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't add that card. Please try again.");
        return;
      }
      const { creditCard } = (await res.json()) as {
        creditCard: { id: string; name: string; issuer: string; creditLimit: string | number; lastFourDigits: string | null };
      };
      // Same fix as accounts: update the client store immediately rather
      // than relying solely on router.refresh(), which doesn't reset an
      // already-mounted page's store state.
      addCreditCard({
        id: creditCard.id,
        name: creditCard.name,
        bank: creditCard.issuer,
        network: network || "Visa",
        creditLimit: Number(creditCard.creditLimit),
        openingOutstanding: 0,
        statementDay: 1,
        dueDay: 15,
        minDuePercent: 0.05,
        lastStatementBalance: 0,
        lastStatementDate: new Date().toISOString().slice(0, 10),
        currency: "INR",
        lastFourDigits: creditCard.lastFourDigits || undefined,
      } satisfies CreditCard);
      showToast({ message: `${finalName} added.` });
      handleClose();
      router.refresh();
    } catch {
      setError("Couldn't add that card. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onClose={handleClose} title="Add credit card">
      <form onSubmit={submit} className="space-y-4 p-5">
        <div>
          <label className="text-xs font-medium text-muted mb-1.5 block">Card issuer / bank</label>
          <input
            list="common-issuers"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder="e.g. HDFC Bank"
            autoFocus
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent"
          />
          <datalist id="common-issuers">
            {COMMON_ISSUERS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>

        <Input
          label="Card nickname (optional)"
          placeholder="e.g. HDFC Millennia"
          value={name}
          onChange={(e) => setName(e.target.value)}
          helperText="Just a name to track it by — no card number needed."
        />

        <div>
          <label className="text-xs font-medium text-muted mb-1.5 block">Network (optional)</label>
          <div className="flex flex-wrap gap-2">
            {NETWORKS.map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setNetwork((cur) => (cur === n ? "" : n))}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm transition-colors",
                  network === n ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Last 4 digits (optional)"
          placeholder="1234"
          inputMode="numeric"
          maxLength={4}
          value={lastFour}
          onChange={(e) => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
          helperText="Lets shared bank SMS match this card automatically."
        />

        {error && <p className="text-xs text-danger">{error}</p>}

        <Button type="submit" loading={submitting} className="w-full">
          Add credit card
        </Button>
      </form>
    </Drawer>
  );
}
