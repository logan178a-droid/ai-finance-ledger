import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { getAuthSession } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Finance Ledger",
  description: "AI-native personal finance ledger for the Indian market",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
