"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { format } from "date-fns";

export interface SettingsUser {
  id: string;
  email: string;
  name: string | null;
  theme: "light" | "dark" | "system";
  timezone: string;
  createdAt: string;
}

export function ProfileTab({ user }: { user: SettingsUser }) {
  const [name, setName] = useState(user.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't save changes.");
        return;
      }
      showToast({ message: "Profile updated." });
    } catch {
      setError("Couldn't save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        <div>
          <label className="text-xs font-medium text-muted mb-1.5 block">Email</label>
          <div className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-muted">{user.email}</div>
          <p className="text-xs text-muted mt-1.5">Email can&rsquo;t be changed here.</p>
        </div>
        <div className="text-xs text-muted">Member since {format(new Date(user.createdAt), "d MMMM yyyy")}</div>

        {error && <p className="text-xs text-danger">{error}</p>}
        <Button size="sm" onClick={save} loading={saving}>
          Save changes
        </Button>
      </Card>

      <Card className="p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Sign out</p>
          <p className="text-xs text-muted mt-0.5">You&rsquo;ll need to sign in again to access your account.</p>
        </div>
        <Button variant="destructive" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign out
        </Button>
      </Card>
    </div>
  );
}
