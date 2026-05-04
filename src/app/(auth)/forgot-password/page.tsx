"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { SubmitButton } from "@/components/ui/submit-button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/reset-password` }
    );
    setLoading(false);
    if (resetErr) {
      setError(resetErr.message);
      return;
    }
    setSent(true);
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

        <div className="glass-card p-8">
          <h1 className="font-display text-xl font-semibold mb-6 text-center">
            Forgot Password?
          </h1>

          {sent ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-[color:var(--dopl-cream)]/75">
                check your email for a reset link.
              </p>
              <p className="text-xs text-[color:var(--dopl-cream)]/40">
                if the address has an account, you&apos;ll get a message
                shortly.
              </p>
              <Link
                href="/login"
                className="inline-block text-xs text-[color:var(--dopl-lime)] hover:underline mt-3"
              >
                back to log in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="text-xs text-[color:var(--dopl-cream)]/55 mb-5">
                enter your email and we&apos;ll send a reset link.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-xs text-red-300">
                  {error}
                </div>
              )}

              <input
                type="email"
                placeholder="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-4 py-3 text-sm placeholder:text-[color:var(--dopl-cream)]/30 mb-4"
              />

              <SubmitButton
                type="submit"
                isPending={loading}
                pendingLabel="sending..."
                className="w-full text-sm py-3"
              >
                Send Reset Link
              </SubmitButton>

              <p className="text-center text-xs text-[color:var(--dopl-cream)]/70 mt-4">
                remembered it?{" "}
                <Link
                  href="/login"
                  className="text-[color:var(--dopl-lime)] hover:underline"
                >
                  log in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
