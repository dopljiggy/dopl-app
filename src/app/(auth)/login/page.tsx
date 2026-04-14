"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const queryError = params.get("error");

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

    // Look up role and route accordingly.
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

    router.replace(role === "fund_manager" ? "/dashboard" : "/feed");
    router.refresh();
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
            className="w-full bg-dopl-deep border border-dopl-sage/30 rounded-lg px-4 py-3 text-sm text-dopl-cream placeholder:text-dopl-cream/30 focus:outline-none focus:border-dopl-lime/50 mb-3"
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-dopl-deep border border-dopl-sage/30 rounded-lg px-4 py-3 text-sm text-dopl-cream placeholder:text-dopl-cream/30 focus:outline-none focus:border-dopl-lime/50 mb-4"
          />

          <button
            type="submit"
            disabled={loading}
            className="btn-lime w-full text-sm py-3"
          >
            {loading ? "signing in..." : "log in"}
          </button>

          <p className="text-center text-xs text-dopl-cream/30 mt-4">
            no account?{" "}
            <Link href="/signup" className="text-dopl-lime hover:underline">
              sign up
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
