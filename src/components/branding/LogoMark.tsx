"use client";

import { useId } from "react";

/**
 * The app's icon mark (`ai-finance-ledger-logo-assets/master.svg`), inlined
 * as JSX rather than an <img> so it stays crisp at any size/zoom and can sit
 * next to text at whatever size the sidebar needs. Gradient/pattern ids are
 * suffixed with a per-instance id since this renders more than once on the
 * same page (desktop sidebar + mobile top bar) — unscoped ids would let one
 * instance's gradients leak into another's.
 */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  const uid = useId();
  const bg = `logoBg-${uid}`;
  const ring = `logoRing-${uid}`;
  const sheen = `logoSheen-${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="AI Finance Ledger" className={className}>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="160" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1B2E63" />
          <stop offset="1" stopColor="#0A1128" />
        </linearGradient>
        <linearGradient id={ring} x1="0" y1="0" x2="160" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9C8CFF" />
          <stop offset="1" stopColor="#4C86FF" />
        </linearGradient>
        <radialGradient id={sheen} cx="28%" cy="18%" r="65%">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.20" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="160" height="160" rx="38" fill={`url(#${bg})`} />
      <rect width="160" height="160" rx="38" fill={`url(#${sheen})`} />

      <rect x="1.25" y="1.25" width="157.5" height="157.5" rx="36.75" fill="none" stroke={`url(#${ring})`} strokeOpacity="0.55" strokeWidth="1.6" />
      <rect x="0.75" y="0.75" width="158.5" height="158.5" rx="37.25" fill="none" stroke="#FFFFFF" strokeOpacity="0.06" strokeWidth="1.2" />

      <rect x="50" y="40" width="74" height="9" rx="4.5" fill="#EDF1FB" fillOpacity="0.42" />
      <rect x="38" y="63" width="86" height="9" rx="4.5" fill="#EDF1FB" fillOpacity="0.75" />

      <path d="M36 94 L65 121 L127 56" fill="none" stroke="#4C86FF" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />

      <path
        d="M130 37 C131.6 44.8 135.2 48.4 143 50 C135.2 51.6 131.6 55.2 130 63 C128.4 55.2 124.8 51.6 117 50 C124.8 48.4 128.4 44.8 130 37 Z"
        fill="#9C8CFF"
      />
    </svg>
  );
}
