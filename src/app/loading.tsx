import { LogoMark } from "@/components/branding/LogoMark";

/**
 * Next.js's built-in loading UI — shown automatically (via React Suspense)
 * the moment navigation starts, while the destination route's async server
 * component (session lookup, DB fetch) is still resolving. This fires on
 * every environment identically (local dev, Vercel) and on first load, so
 * it's the real "logo first, then app" splash, not a fake timed overlay.
 */
export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <LogoMark size={72} className="rounded-2xl animate-breathe" />
    </div>
  );
}
