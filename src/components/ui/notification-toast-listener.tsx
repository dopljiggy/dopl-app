"use client";

import { useEffect, useRef } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { fireToast } from "@/lib/dopl-toast";

/**
 * Mount once per authed dopler shell. Listens to notification realtime
 * inserts via useNotifications and fires a toast for each NEW row. Does
 * not render any visible UI.
 */
export function NotificationToastListener({
  userId,
}: {
  userId: string | null;
}) {
  const { notifications } = useNotifications(userId);
  const lastSeenIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (notifications.length === 0) return;
    const latest = notifications[0];
    if (!latest) return;

    // Skip the initial fetch burst: on mount, capture the latest row's id
    // without firing. Only fire on subsequent inserts.
    if (lastSeenIdRef.current === null) {
      lastSeenIdRef.current = latest.id;
      return;
    }
    if (latest.id === lastSeenIdRef.current) return;
    lastSeenIdRef.current = latest.id;

    // Guard against clock skew: negative age means client is ahead of server;
    // positive but large means we're reading stale data. Only fire for
    // notifications within a reasonable recency window.
    const age = Date.now() - new Date(latest.created_at).getTime();
    if (age > 10_000 || age < -5_000) return;

    fireToast({ title: latest.title, body: latest.body ?? undefined });
  }, [notifications]);

  return null;
}
