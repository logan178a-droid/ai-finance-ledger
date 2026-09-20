import type { Metadata } from "next";
import { Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { getAuthSession } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

const manrope = Manrope({
  variable: "--font-manrope",
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Finance Ledger",
  description: "AI-native personal finance ledger for the Indian market",
  icons: {
    // src/app/favicon.ico is auto-served at /favicon.ico by Next.js
    // convention; these are the additional sizes browsers/OSes pick from.
    icon: [
      { url: "/icons/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

// Reads the session on every request (DB-backed theme lookup below) — must
// not be statically cached, or a signed-in user's theme could leak into
// another visitor's cached HTML.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Server-side theme lookup so the correct theme is in the very first
  // response — no flash of the wrong theme, and it's a real per-account
  // preference (persists across devices/sessions), not just localStorage.
  const session = await getAuthSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { theme: true } }) : null;
  const theme = user?.theme ?? "system";

  return (
    <html
      lang="en"
      // "system" intentionally sets no attribute — globals.css then falls
      // through to the prefers-color-scheme media query.
      {...(theme !== "system" && { "data-theme": theme })}
      className={`${manrope.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SessionProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
