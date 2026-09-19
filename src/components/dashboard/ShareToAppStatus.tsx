"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radio, Download } from "lucide-react";

/**
 * Share-to-app is now the app's primary, most "automatic-feeling" capture
 * method — this reflects its REAL state, not a fake badge: `display-mode:
 * standalone` only matches when the app is actually installed (Add to Home
 * Screen / TWA), which is exactly the condition `share_target` in the web
 * manifest needs to register with the OS share sheet (see `manifest.ts`).
 * So "active" here means it genuinely is.
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

  // Avoid a flash of the wrong state before the check runs client-side.
  if (installed === null) return null;

  if (installed) {
    return (
      <div className="flex items-center justify-center gap-2 text-xs text-positive mb-4">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-positive opacity-60 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
        </span>
        Share-to-app active — bank SMS you share land here automatically
      </div>
    );
  }

  return (
    <Link
      href="/settings?tab=share-setup"
      className="flex items-center justify-center gap-2 text-xs text-muted hover:text-accent transition-colors mb-4 group"
    >
      <Radio size={13} className="shrink-0" />
      Set up Share-to-app once — most transactions log themselves after
      <span className="text-accent font-medium inline-flex items-center gap-1">
        <Download size={12} /> Install
      </span>
    </Link>
  );
}
