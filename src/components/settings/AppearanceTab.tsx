"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { Sun, Moon, Monitor, Check } from "lucide-react";

type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun; description: string }[] = [
  { value: "light", label: "Light", icon: Sun, description: "Always use the light theme." },
  { value: "dark", label: "Dark", icon: Moon, description: "Always use the dark theme." },
  { value: "system", label: "System", icon: Monitor, description: "Match your device's setting." },
];

/**
 * Applies immediately (optimistic, no reload needed) by setting the
 * `data-theme` attribute directly, then persists to the database via
 * `PATCH /api/user/settings` — a real per-account preference. The root
 * layout reads it server-side on every request, so it's also what a fresh
 * page load / different device sees, not just this tab's local state.
 */
export function AppearanceTab({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function choose(value: Theme) {
    if (value === theme) return;
    const previous = theme;
    setTheme(value);
    if (value === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", value);
    }

    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: value }),
      });
      if (!res.ok) throw new Error();
      showToast({ message: `Theme set to ${value}.` });
    } catch {
      // Revert on failure so the UI never claims a preference that didn't save.
      setTheme(previous);
      if (previous === "system") document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", previous);
      showToast({ message: "Couldn't save theme. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold mb-1">Theme</h2>
      <p className="text-xs text-muted mb-4">Applies across the whole app and is saved to your account.</p>
      <div className="grid sm:grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const active = theme === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              onClick={() => choose(opt.value)}
              disabled={saving}
              className={cn(
                "relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors disabled:opacity-60",
                active ? "border-accent bg-accent-soft" : "border-border hover:bg-background"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <Icon size={18} className={active ? "text-accent" : "text-muted"} />
                {active && <Check size={14} className="text-accent" />}
              </div>
              <div>
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-muted mt-0.5">{opt.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
