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
      { src: "/icons/icon-16.png", sizes: "16x16", type: "image/png", purpose: "any" },
      { src: "/icons/icon-32.png", sizes: "32x32", type: "image/png", purpose: "any" },
      { src: "/icons/icon-48.png", sizes: "48x48", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-256.png", sizes: "256x256", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Separate maskable icons — Android crops "any" icons into a shape
      // (circle, squircle, etc.) using a safe-zone it assumes exists; these
      // are drawn with that safe margin baked in, so the mark doesn't get
      // clipped oddly on the home screen.
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
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
