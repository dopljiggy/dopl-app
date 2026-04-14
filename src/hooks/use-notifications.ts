"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { Notification } from "@/types/database";

/**
 * Safely tracks a user's notifications + unread count with realtime inserts.
 * All Supabase calls are try/caught so transient network or RLS errors don't
 * crash the layout that hosts this hook.
 */
export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    const supabase = createClient();
    let mounted = true;

    void (async () => {
      try {
        const { data } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (!mounted) return;
        const rows = (data as Notification[]) ?? [];
        setNotifications(rows);
        setUnreadCount(rows.filter((n) => !n.read).length);
      } catch (e) {
        console.warn("useNotifications fetch failed:", e);
      }
    })();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;
    try {
      channel = supabase
        .channel(`notifications-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const n = payload.new as Notification;
            setNotifications((prev) => [n, ...prev]);
            setUnreadCount((c) => c + 1);
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("useNotifications realtime failed:", e);
    }

    return () => {
      mounted = false;
      if (channel) {
        try {
          void supabase.removeChannel(channel);
        } catch {
          /* swallow */
        }
      }
    };
  }, [userId]);

  const markAllRead = async () => {
    if (!userId || unreadCount === 0) return;
    try {
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.warn("markAllRead failed:", e);
    }
  };

  return { notifications, unreadCount, markAllRead };
}
