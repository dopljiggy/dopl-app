"use client";

import { useEffect } from "react";

/**
 * Registers the service worker and force-reloads the page when a new SW
 * activates (we broadcast `dopl-sw-updated` from the SW's activate handler).
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    // Reload on SW update message.
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "dopl-sw-updated") {
        // Small debounce to let the SW take control before reloading.
        setTimeout(() => window.location.reload(), 120);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Prompt updating SW to activate immediately.
          if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
          reg.onupdatefound = () => {
            const sw = reg.installing;
            if (!sw) return;
            sw.onstatechange = () => {
              if (sw.state === "activated") {
                // Also reload here in case the message got lost.
                setTimeout(() => window.location.reload(), 120);
              }
            };
          };
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn("sw registration failed", err);
        });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
