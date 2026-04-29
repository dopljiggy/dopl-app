"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Full-screen splash that only shows when the app is launched from the home
 * screen in standalone mode. Dismisses on a `dopl:content-ready` event
 * (typically dispatched within 400-600ms by the first client wrapper that
 * mounts), with a 400ms minimum to avoid a jarring flash and a 2000ms
 * maximum fallback if no dispatcher fires.
 *
 * Race-safety: the dispatchers set `window.__doplContentReady = true` BEFORE
 * dispatching the event. This effect checks the flag synchronously on mount
 * before adding the listener, so the splash dismisses correctly even if
 * content's effects ran before the splash mounted (concurrent rendering,
 * Suspense streaming, JSX reordering).
 */
export default function StandaloneSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;
    if (!isStandalone) return;

    setShow(true);
    const start = Date.now();
    const MIN = 400;
    const MAX = 2000;

    const dismiss = () => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, MIN - elapsed);
      setTimeout(() => setShow(false), remaining);
    };

    // Defensive: if a dispatcher already fired before this effect ran,
    // the global flag is set — dismiss immediately without registering
    // a listener that would never trigger.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).__doplContentReady) {
      dismiss();
      return;
    }

    window.addEventListener("dopl:content-ready", dismiss, { once: true });
    const fallback = setTimeout(dismiss, MAX);
    return () => {
      window.removeEventListener("dopl:content-ready", dismiss);
      clearTimeout(fallback);
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
          className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center"
          style={{ background: "#0D261F" }}
          aria-hidden
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
            className="relative"
          >
            <div
              className="absolute -inset-10 rounded-full blur-3xl"
              style={{
                background: "rgba(197, 214, 52, 0.25)",
                animation: "splash-pulse 1.4s ease-in-out infinite",
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dopl-logo.svg"
              alt="dopl"
              width={120}
              height={120}
              className="relative"
            />
          </motion.div>
          <style>{`
            @keyframes splash-pulse {
              0%, 100% { opacity: 0.55; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.08); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
