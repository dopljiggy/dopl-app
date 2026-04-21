"use client";

import { createContext, useContext, ReactNode } from "react";
import type { Notification } from "@/types/database";

type FmNotificationsContextValue = {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
};

const FmNotificationsContext =
  createContext<FmNotificationsContextValue | null>(null);

/**
 * FM-side sibling of `NotificationsProvider`. Owner (DashboardChrome) runs
 * `useFmNotifications(userId)` once and passes the result as `value`, so
 * the bell and the activity page share one Realtime subscription — no
 * double-subscribe race (the bug Sprint 3 Task 6 eliminated on the dopler
 * side, applied here to the FM side).
 */
export function FmNotificationsProvider({
  value,
  children,
}: {
  value: FmNotificationsContextValue;
  children: ReactNode;
}) {
  return (
    <FmNotificationsContext.Provider value={value}>
      {children}
    </FmNotificationsContext.Provider>
  );
}

export function useFmNotificationsContext(): FmNotificationsContextValue {
  const ctx = useContext(FmNotificationsContext);
  if (!ctx) {
    throw new Error(
      "useFmNotificationsContext must be used inside DashboardChrome (which provides FmNotificationsProvider)."
    );
  }
  return ctx;
}
