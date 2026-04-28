"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

export default function PushPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (!("serviceWorker" in navigator)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem("dopl-push-dismissed")) return;

    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const subscribe = async () => {
    setShow(false);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      userVisibleOnly: true,
    });

    const serialized = sub.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: serialized.endpoint,
        keys: serialized.keys,
      }),
    });
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("dopl-push-dismissed", "1");
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-32 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50">
      <div className="relative bg-[color:var(--dopl-deep-2)] border border-[color:var(--glass-border-strong)] rounded-2xl p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-[color:var(--dopl-cream)]/40 hover:text-[color:var(--dopl-cream)]"
        >
          <X size={14} />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] shrink-0">
            <Bell size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold mb-1">
              get notified when your fund managers trade
            </p>
            <p className="text-xs text-[color:var(--dopl-cream)]/50 mb-3">
              push notifications for position changes. works best as a home screen app.
            </p>
            <button
              onClick={subscribe}
              className="btn-lime text-xs px-4 py-2"
            >
              enable notifications
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
