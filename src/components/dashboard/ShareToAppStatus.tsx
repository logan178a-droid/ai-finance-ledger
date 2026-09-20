"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Smartphone } from "lucide-react";

/**
 * Full-width status pill — reflects REAL PWA install state via
 * `display-mode: standalone` (which is exactly the condition `share_target`
 * in the web manifest needs to register with the OS share sheet), never a
 * fake "always active" badge.
 */
export function ShareToAppStatus() {
  const [installed, setInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const update = () => setInstalled(mq.matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (installed === null) return <div style={{ height: 46 }} />;

  if (installed) {
    return (
      <div
        className="flex items-center gap-2.5"
        style={{
          padding: "11px 14px",
          borderRadius: 14,
          background: "rgba(52,214,166,0.08)",
          border: "1px solid rgba(52,214,166,0.22)",
        }}
      >
        <span
          className="relative shrink-0"
          style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D6A6", boxShadow: "0 0 0 4px rgba(52,214,166,0.18)" }}
        >
          <span className="absolute inset-0 rounded-full animate-ping" style={{ background: "#34D6A6", opacity: 0.6 }} />
        </span>
        <div className="flex-1 min-w-0" style={{ fontSize: 12.5, fontWeight: 600, color: "#B9F2E0" }}>
          Capturing automatically · Share-to-app active
        </div>
        <ChevronRight size={14} color="#7FE3C4" strokeWidth={2.4} className="shrink-0" />
      </div>
    );
  }

  return (
    <Link
      href="/settings?tab=share-setup"
      className="flex items-center gap-2.5"
      style={{
        padding: "11px 14px",
        borderRadius: 14,
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <Smartphone size={14} color="var(--muted)" strokeWidth={2.2} className="shrink-0" />
      <div className="flex-1 min-w-0" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
        Set up Share-to-app — most transactions log themselves after
      </div>
      <ChevronRight size={14} color="var(--muted)" strokeWidth={2.4} className="shrink-0" />
    </Link>
  );
}
