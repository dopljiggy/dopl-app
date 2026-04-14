"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

/**
 * Subscribes to realtime portfolio_updates for this portfolio.
 * On any insert, refreshes the page so the new positions/updates render.
 */
export default function LiveUpdates({
  portfolioId,
  canView,
}: {
  portfolioId: string;
  canView: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!canView) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`portfolio-${portfolioId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "portfolio_updates",
          filter: `portfolio_id=eq.${portfolioId}`,
        },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [portfolioId, canView, router]);

  return null;
}
