"use client";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Mail, Lock, ShieldCheck, CheckCircle2, Sparkles } from "lucide-react";

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("abhi@zivan.health");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(next);
    }
  }, [loading, next, router, user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await login(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(next);
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("demo1234");
    setError(null);
  }

  return (
    <div className="w-full max-w-md rounded-[2.5rem] border border-border bg-white/95 p-7 shadow-[0_24px_60px_rgba(15,61,53,0.12)] backdrop-blur-md sm:p-9">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary shadow-xs">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Member Portal
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Welcome back
            </h1>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-teal-200/80 bg-teal-50/70 px-3.5 py-2 text-xs font-semibold text-teal-950">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span>Connected to Supabase Cloud Database</span>
      </div>

      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-bold text-foreground">
            Email address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 w-full rounded-2xl border border-border bg-[#fbfefd] pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-bold text-foreground">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-2xl border border-border bg-[#fbfefd] pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full shadow-[0_8px_25px_rgba(13,143,122,0.35)] hover:shadow-[0_12px_32px_rgba(13,143,122,0.45)]"
          size="lg"
          disabled={submitting}
        >
          {submitting ? "Authenticating with Backend..." : "Sign In & Sync Data"}
        </Button>
      </form>

      {/* Demo quick fill */}
      <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 text-xs">
        <p className="font-bold text-slate-700 mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          Quick Test Accounts:
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fillDemo("abhi@zivan.health")}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-800 hover:border-primary hover:text-primary transition"
          >
            Abhijeet Das (Demo)
          </button>
          <button
            type="button"
            onClick={() => fillDemo("member@zivan.health")}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-800 hover:border-primary hover:text-primary transition"
          >
            New Member
          </button>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted sm:text-sm">
        New to ZIVAN?{" "}
        <Link href="/signup" className="font-bold text-primary hover:underline">
          Create an account
        </Link>
      </p>

      {/* Hospital Portal Link */}
      <div className="mt-4 pt-4 border-t border-border/80 text-center">
        <a
          href="https://nexora-zivan.vercel.app/hospital/login"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-950 hover:bg-teal-100 transition shadow-2xs"
        >
          <span>🏥 Hospital Staff &amp; Dispatch Login →</span>
        </a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md rounded-[2rem] border border-border bg-white p-8 text-center text-sm text-muted">
          Loading...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
