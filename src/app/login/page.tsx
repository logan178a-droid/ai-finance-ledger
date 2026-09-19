"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Wordmark } from "@/components/branding/Wordmark";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Invalid email or password.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <div className="mb-6">
          <Wordmark height={34} />
        </div>
        <h1 className="text-lg font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-muted mb-6">Welcome back. Enter your details to continue.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            type="email"
            label="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            label="Password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" size="lg" loading={loading} className="w-full mt-1">
            Sign in
          </Button>
        </form>

        <p className="text-xs text-muted mt-6">
          Don&apos;t have an account?{" "}
          <a href="/register" className="text-accent font-medium hover:underline">
            Create one
          </a>
        </p>
        <p className="text-xs text-muted-soft mt-3">
          Demo login: <span className="font-mono">demo@example.com</span> / <span className="font-mono">Demo@1234</span> (after seeding)
        </p>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
