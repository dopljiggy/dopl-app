"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const queryError = params.get("error");
  const nextParam = params.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) {
      setLoading(false);
      setError(signInErr.message);
      return;
    }

    const userId = data.user?.id;
    let role: "fund_manager" | "subscriber" = "subscriber";
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.role === "fund_manager") role = "fund_manager";
    }

    const fallback = role === "fund_manager" ? "/dashboard" : "/feed";
    const target = nextParam && nextParam.startsWith("/") ? nextParam : fallback;
    window.location.href = target;
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="font-display text-3xl font-semibold block text-center mb-10"
        >
          dopl
        </Link>

        <form onSubmit={handleLogin} className="glass-card p-8">
          <h1 className="font-display text-xl font-semibold mb-6 text-center">
            log in
          </h1>

          {(error || queryError) && (
            <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-xs text-red-300">
              {error ?? queryError}
            </div>
          )}

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
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-4 py-3 text-sm placeholder:text-[color:var(--dopl-cream)]/30 mb-4"
          />

          <button
            type="submit"
            disabled={loading}
            className="btn-lime w-full text-sm py-3"
          >
            {loading ? "signing in..." : "log in"}
          </button>

          <p className="text-center text-xs text-[color:var(--dopl-cream)]/30 mt-4">
            no account?{" "}
            <Link
              href={`/signup${
                nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""
              }`}
              className="text-[color:var(--dopl-lime)] hover:underline"
            >
              sign up
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
