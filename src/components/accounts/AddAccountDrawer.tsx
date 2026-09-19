"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useStore } from "@/lib/store/StoreContext";
import { cn } from "@/lib/utils";
import type { Account } from "@/lib/types";

const ACCOUNT_TYPES = [
  { value: "bank", label: "Bank Account" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
] as const;

const COMMON_BANKS = [
  "State Bank of India",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Punjab National Bank",
  "Bank of Baroda",
  "Canara Bank",
  "IDFC FIRST Bank",
  "Yes Bank",
  "IndusInd Bank",
  "Union Bank of India",
];

export function AddAccountDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { addAccount } = useStore();
  const [type, setType] = useState<(typeof ACCOUNT_TYPES)[number]["value"]>("bank");
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setType("bank");
    setName("");
    setInstitution("");
    setLastFour("");
    setOpeningBalance("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // A bank account's nickname is optional — falls back to the bank name
    // itself (e.g. "HDFC Bank") so the required-name rule never blocks
    // submission just because the user skipped naming it something extra.
    const finalName = name.trim() || institution.trim();
    if (!finalName) {
      setError(type === "bank" ? "Enter a bank name or a nickname." : "Give this account a name.");
      return;
    }
    if (lastFour && !/^\d{4}$/.test(lastFour)) {
      setError("Last 4 digits must be exactly 4 numbers, or left blank.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: finalName,
          institution: institution.trim() || null,
          lastFourDigits: lastFour || undefined,
          openingBalance: openingBalance ? Number(openingBalance) : 0,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't add that account. Please try again.");
        return;
      }
      const { account } = (await res.json()) as { account: { id: string; name: string; institution: string | null; type: Account["type"]; openingBalance: string | number; lastFourDigits: string | null } };
      // Update the client store immediately — router.refresh() alone re-fetches
      // server data but does NOT reset this page's already-mounted store (its
      // useReducer only reads its initial data once, on first mount), so
      // without this the new account would silently not appear until a full
      // page reload even though the save itself succeeded.
      addAccount({
        id: account.id,
        name: account.name,
        bank: account.institution ?? "",
        type: account.type,
        openingBalance: Number(account.openingBalance),
        currency: "INR",
        lastFourDigits: account.lastFourDigits || undefined,
      });
      showToast({ message: `${finalName} added.` });
      reset();
      onClose();
      router.refresh();
    } catch {
      setError("Couldn't add that account. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Add account">
      <form onSubmit={submit} className="space-y-4 p-5">
        <div>
          <label className="text-xs font-medium text-muted mb-1.5 block">Account type</label>
          <div className="flex gap-2">
            {ACCOUNT_TYPES.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => setType(t.value)}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2 text-sm transition-colors",
                  type === t.value ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {type === "bank" && (
          <div>
            <label className="text-xs font-medium text-muted mb-1.5 block">Bank name</label>
            <input
              list="common-banks"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. HDFC Bank"
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent"
            />
            <datalist id="common-banks">
              {COMMON_BANKS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
        )}
        {type === "investment" && (
          <Input label="Platform (optional)" placeholder="e.g. Zerodha" value={institution} onChange={(e) => setInstitution(e.target.value)} />
        )}

        <Input
          label={type === "bank" ? "Account nickname (optional)" : "Account name"}
          placeholder={type === "bank" ? "e.g. Salary Account" : type === "cash" ? "e.g. Cash Wallet" : "e.g. Mutual Funds"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        {type === "bank" && (
          <Input
            label="Last 4 digits (optional)"
            placeholder="1234"
            inputMode="numeric"
            maxLength={4}
            value={lastFour}
            onChange={(e) => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
            helperText="Lets shared bank SMS match this account automatically."
          />
        )}

        <Input
          label="Opening balance"
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={openingBalance}
          onChange={(e) => setOpeningBalance(e.target.value)}
          helperText="Your account's balance today — future transactions adjust it from here."
        />

        {error && <p className="text-xs text-danger">{error}</p>}

        <Button type="submit" loading={submitting} className="w-full">
          Add account
        </Button>
      </form>
    </Drawer>
  );
}
