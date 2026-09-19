"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/** Just the card name — we don't collect real card numbers/limits/dates, only a label to track it by. */
export function AddCreditCardDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give this card a name.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/credit-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't add that card.");
        return;
      }
      showToast({ message: `${name.trim()} added.` });
      handleClose();
      router.refresh();
    } catch {
      setError("Couldn't add that card. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onClose={handleClose} title="Add credit card">
      <form onSubmit={submit} className="space-y-4 p-5">
        <Input
          label="Card name"
          placeholder="e.g. HDFC Millennia"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          helperText="Just a name to track it by — no card details needed."
        />

        {error && <p className="text-xs text-danger">{error}</p>}

        <Button type="submit" loading={submitting} className="w-full">
          Add credit card
        </Button>
      </form>
    </Drawer>
  );
}
