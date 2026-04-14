"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Brief full-screen splash that only shows when the app is launched from the
 * home screen in standalone mode. Fades out after ~1.2s.
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
    const t = setTimeout(() => setShow(false), 1500);
    return () => clearTimeout(t);
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
