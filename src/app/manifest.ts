import type { MetadataRoute } from "next";

/**
 * Web app manifest — required for the app to be installable (Android "Add
 * to Home Screen" / TWA/Play Store wrapping) and for `share_target` to
 * register with Android's share sheet. See `/share/route.ts` for the
 * handler this points at.
 *
 * IMPORTANT: `share_target` only takes effect once the PWA is installed —
 * a plain browser tab visit never registers as a share target with
 * Android. A TWA installed from the Play Store counts as "installed" (it's
 * Chrome's engine under a thin native shell, verified via Digital Asset
 * Links), so this works there; it won't appear in the share sheet for
 * someone who only visited the site in a browser without installing.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Finance Ledger",
    short_name: "AI Finance",
    description: "AI-native personal finance ledger — log transactions by talking, or share a bank SMS straight into the app.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1128",
    theme_color: "#0a1128",
    icons: [
      { src: "/api/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Android-only: iOS Safari doesn't support apps registering as Web
    // Share Targets, so this simply won't appear as a share destination on
    // iOS — expected, not a bug.
    share_target: {
      action: "/share",
      method: "POST",
      enctype: "application/x-www-form-urlencoded",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
  };
}
