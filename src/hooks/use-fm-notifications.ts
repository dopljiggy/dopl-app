"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { Notification } from "@/types/database";

const FM_EVENTS: Notification["change_type"][] = [
  "subscription_added",
  "subscription_cancelled",
];

/**
 * FM-scoped sibling of `useNotifications`. Same shape, but the initial
 * fetch and realtime firehose are both narrowed to FM-side event types
 * (`subscription_added`, `subscription_cancelled`). Supabase Realtime's
 * `filter` option only supports `eq` per channel, so INSERTs for the user
 * stream through this hook and get dropped client-side if they're not FM
 * events — keeps the FM bell from picking up position-change notifications
 * that an FM-who's-also-a-dopler would receive.
 */
export function useFmNotifications(userId: string | null) {
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
          .in("change_type", FM_EVENTS as string[])
          .order("created_at", { ascending: false })
          .limit(50);
        if (!mounted) return;
        const rows = (data as Notification[]) ?? [];
        setNotifications(rows);
        setUnreadCount(rows.filter((n) => !n.read).length);
      } catch (e) {
        console.warn("useFmNotifications fetch failed:", e);
      }
    })();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;
    try {
      channel = supabase
        .channel(`fm-notifications-${userId}`)
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
            if (
              n.change_type !== "subscription_added" &&
              n.change_type !== "subscription_cancelled"
            ) {
              return; // ignore non-FM events
            }
            setNotifications((prev) => [n, ...prev]);
            setUnreadCount((c) => c + 1);
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("useFmNotifications realtime failed:", e);
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
        .eq("read", false)
        .in("change_type", FM_EVENTS as string[]);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.warn("fm markAllRead failed:", e);
    }
  };

  return { notifications, unreadCount, markAllRead };
}
