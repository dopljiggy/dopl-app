"use client";

import { createClient } from "@/lib/supabase";
import { useState } from "react";

export default function SignOutButton() {
  const [loading, setLoading] = useState(false);

  const signOut = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Full page reload — stale session cookies cause bugs with router.push.
    window.location.href = "/";
  };

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className="glass-card-light px-5 py-2.5 text-sm rounded-xl hover:bg-red-500/10 hover:text-red-300 transition-colors"
    >
      {loading ? "signing out..." : "sign out"}
    </button>
  );
}
