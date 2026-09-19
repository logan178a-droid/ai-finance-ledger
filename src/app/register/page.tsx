"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Wordmark } from "@/components/branding/Wordmark";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create account.");
        return;
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Account created — please sign in.");
        router.push("/login");
        return;
      }
      router.push("/");
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
        <h1 className="text-lg font-semibold mb-1">Create your account</h1>
        <p className="text-sm text-muted mb-6">Start tracking your money in plain English.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
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
            autoComplete="new-password"
            required
            minLength={8}
            helperText="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" size="lg" loading={loading} className="w-full mt-1">
            Create account
          </Button>
        </form>

        <p className="text-xs text-muted mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-accent font-medium hover:underline">
            Sign in
          </a>
        </p>
      </Card>
    </div>
  );
}
