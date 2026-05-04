"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { SubmitButton } from "@/components/ui/submit-button";
import { fireToast } from "@/components/ui/toast";

export default function ResetPasswordPage() {
  // Wrapped in Suspense because Supabase's recovery flow lands on this URL
  // with hash-fragment session tokens that the client SDK consumes during
  // mount (and Next.js requires the suspense boundary for any URL-param
  // consumer in app router static-generation contexts).
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("passwords don't match");
      return;
    }
    setLoading(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    fireToast({
      title: "password updated",
      body: "you can now log in with your new password.",
    });
    router.push("/login");
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

        <form onSubmit={handleSubmit} className="glass-card p-8">
          <h1 className="font-display text-xl font-semibold mb-6 text-center">
            Reset Password
          </h1>

          {error && (
            <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-xs text-red-300">
              {error}
            </div>
          )}

          <input
            type="password"
            placeholder="new password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-4 py-3 text-sm placeholder:text-[color:var(--dopl-cream)]/30 mb-3"
          />
          <input
            type="password"
            placeholder="confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-4 py-3 text-sm placeholder:text-[color:var(--dopl-cream)]/30 mb-4"
          />

          <SubmitButton
            type="submit"
            isPending={loading}
            pendingLabel="updating..."
            className="w-full text-sm py-3"
          >
            Update Password
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
