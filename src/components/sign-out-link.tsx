"use client";

import { createClient } from "@/lib/supabase";
import { LogOut } from "lucide-react";
import { useState } from "react";

export default function SignOutLink({
  className,
  showIcon = true,
}: {
  className?: string;
  showIcon?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const signOut = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className={
        className ??
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)] hover:bg-[color:var(--dopl-sage)]/20 transition-colors w-full text-left"
      }
    >
      {showIcon && <LogOut size={16} />}
      {loading ? "signing out…" : "sign out"}
    </button>
  );
}
