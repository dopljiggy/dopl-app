"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryError = params.get("error");
  const nextParam = params.get("next");
  const roleParam = params.get("role");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"fund_manager" | "subscriber">(
    roleParam === "dopler" || roleParam === "subscriber"
      ? "subscriber"
      : "fund_manager"
  );
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("password must be at least 8 characters");
      return;
    }
    if (role === "fund_manager" && !handle) {
      setError("handle is required for fund managers");
      return;
    }

    setLoading(true);

    const { error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          handle: role === "fund_manager" ? handle : undefined,
        },
      },
    });
    if (signUpErr && !signUpErr.message.toLowerCase().includes("already")) {
      setLoading(false);
      setError(signUpErr.message);
      return;
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) {
      setLoading(false);
      setError(
        signInErr.message.toLowerCase().includes("confirm")
          ? "email confirmation is still enabled in Supabase — disable it under Auth → Providers → Email"
          : signInErr.message
      );
      return;
    }

    const provisionRes = await fetch("/api/auth/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        full_name: fullName,
        handle: role === "fund_manager" ? handle : undefined,
      }),
    });
    if (!provisionRes.ok) {
      const j = await provisionRes.json().catch(() => ({}));
      setLoading(false);
      setError(j.error ?? "could not finish setting up your account");
      return;
    }

    // Routing — prefer explicit `next` when provided, else role default.
    const fallback =
      role === "fund_manager" ? "/onboarding" : "/welcome";
    const target = nextParam && nextParam.startsWith("/") ? nextParam : fallback;
    router.replace(target);
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="font-display text-3xl font-semibold block text-center mb-10"
        >
          dopl
        </Link>

        <form onSubmit={handleSignup} className="glass-card p-8">
          <h1 className="font-display text-xl font-semibold mb-6 text-center">
            get started
          </h1>

          {(error || queryError) && (
            <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-xs text-red-300">
              {error ?? queryError}
            </div>
          )}

          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setRole("fund_manager")}
              className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all ${
                role === "fund_manager"
                  ? "bg-[color:var(--dopl-lime)] text-[color:var(--dopl-deep)]"
                  : "glass-card-light text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)]"
              }`}
            >
              fund manager
            </button>
            <button
              type="button"
              onClick={() => setRole("subscriber")}
              className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all ${
                role === "subscriber"
                  ? "bg-[color:var(--dopl-lime)] text-[color:var(--dopl-deep)]"
                  : "glass-card-light text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)]"
              }`}
            >
              dopler
            </button>
          </div>

          <input
            type="text"
            placeholder="full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-4 py-3 text-sm placeholder:text-[color:var(--dopl-cream)]/30 mb-3"
          />
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-4 py-3 text-sm placeholder:text-[color:var(--dopl-cream)]/30 mb-3"
          />
          <input
            type="password"
            placeholder="password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-4 py-3 text-sm placeholder:text-[color:var(--dopl-cream)]/30 mb-3"
          />

          {role === "fund_manager" && (
            <div className="relative mb-3">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--dopl-cream)]/30 text-sm">
                dopl.com/
              </span>
              <input
                type="text"
                placeholder="handle"
                value={handle}
                onChange={(e) =>
                  setHandle(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "")
                  )
                }
                required
                className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg pl-[5.5rem] pr-4 py-3 text-sm placeholder:text-[color:var(--dopl-cream)]/30"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-lime w-full text-sm py-3 mt-2"
          >
            {loading ? "creating account..." : "create account"}
          </button>

          <p className="text-center text-xs text-[color:var(--dopl-cream)]/30 mt-4">
            already have an account?{" "}
            <Link
              href={`/login${
                nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""
              }`}
              className="text-[color:var(--dopl-lime)] hover:underline"
            >
              log in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
