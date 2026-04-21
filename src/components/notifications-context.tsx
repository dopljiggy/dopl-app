"use client";

import { createContext, useContext, ReactNode } from "react";
import type { Notification } from "@/types/database";

type NotificationsContextValue = {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
  /**
   * Portfolio ids the viewing dopler is currently `status='active'` on.
   * Used by `NotificationPopup` to gate stale `actionable` flags: a
   * notification for a portfolio the dopler no longer subscribes to
   * renders a "view portfolio" CTA instead of a broker-action CTA.
   */
  activeSubscribedPortfolioIds: Set<string>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: NotificationsContextValue;
}) {
  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      "useNotificationsContext must be used inside DoplerShell (which provides NotificationsProvider)."
    );
  }
  return ctx;
}
