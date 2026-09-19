"use client";

import { useId } from "react";

/**
 * The full logo lockup (mark + "AI Finance Ledger" text), theme-aware: both
 * the dark-background and light-background variants render, and CSS (see
 * `.wordmark-dark-variant` / `.wordmark-light-variant` in globals.css,
 * mirroring the app's existing `data-theme` rules) shows only the one that's
 * actually readable against the current background — so this needs no
 * client-side theme detection of its own and never flashes the wrong one.
 */
export function Wordmark({ height = 40, className }: { height?: number; className?: string }) {
  return (
    <span className={className} style={{ display: "inline-block", height }}>
      <DarkBgWordmark height={height} />
      <LightBgWordmark height={height} />
    </span>
  );
}

function DarkBgWordmark({ height }: { height: number }) {
  const uid = useId();
  const bg = `wmBg-${uid}`;
  return (
    <svg width={(720 / 160) * height} height={height} viewBox="0 0 720 160" role="img" aria-label="AI Finance Ledger" className="wordmark-dark-variant">
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="160" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1B2E63" />
          <stop offset="1" stopColor="#0A1128" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="38" fill={`url(#${bg})`} />
      <rect x="50" y="40" width="74" height="9" rx="4.5" fill="#EDF1FB" fillOpacity="0.42" />
      <rect x="38" y="63" width="86" height="9" rx="4.5" fill="#EDF1FB" fillOpacity="0.75" />
      <path d="M36 94 L65 121 L127 56" fill="none" stroke="#4C86FF" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M130 37 C131.6 44.8 135.2 48.4 143 50 C135.2 51.6 131.6 55.2 130 63 C128.4 55.2 124.8 51.6 117 50 C124.8 48.4 128.4 44.8 130 37 Z"
        fill="#9C8CFF"
      />
      <text x="196" y="98" fontFamily="Manrope, system-ui, sans-serif" fontWeight="800" fontSize="52" letterSpacing="-1">
        <tspan fill="#9C8CFF">AI</tspan>
        <tspan fill="#EDF1FB"> Finance Ledger</tspan>
      </text>
    </svg>
  );
}

function LightBgWordmark({ height }: { height: number }) {
  return (
    <svg width={(720 / 160) * height} height={height} viewBox="0 0 720 160" role="img" aria-label="AI Finance Ledger" className="wordmark-light-variant">
      <rect width="160" height="160" rx="38" fill="#F2F5FC" />
      <rect x="50" y="40" width="74" height="9" rx="4.5" fill="#37436B" fillOpacity="0.5" />
      <rect x="38" y="63" width="86" height="9" rx="4.5" fill="#37436B" fillOpacity="0.8" />
      <path d="M36 94 L65 121 L127 56" fill="none" stroke="#2F63D6" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M130 37 C131.6 44.8 135.2 48.4 143 50 C135.2 51.6 131.6 55.2 130 63 C128.4 55.2 124.8 51.6 117 50 C124.8 48.4 128.4 44.8 130 37 Z"
        fill="#7A66FF"
      />
      <text x="196" y="98" fontFamily="Manrope, system-ui, sans-serif" fontWeight="800" fontSize="52" letterSpacing="-1">
        <tspan fill="#5B3FE0">AI</tspan>
        <tspan fill="#101B3F"> Finance Ledger</tspan>
      </text>
    </svg>
  );
}
