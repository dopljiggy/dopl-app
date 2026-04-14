"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share, Plus } from "lucide-react";

const DISMISS_KEY = "dopl-install-dismissed-v1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isMobile() {
  if (typeof window === "undefined") return false;
  return (
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) &&
    window.matchMedia("(max-width: 820px)").matches
  );
}

function isIOS() {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  );
}

export default function PWAInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosFallback, setIosFallback] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    if (!isMobile()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS doesn't fire beforeinstallprompt — show manual instructions after a
    // short delay so we don't blast visitors immediately.
    if (isIOS()) {
      const t = setTimeout(() => {
        setIosFallback(true);
        setVisible(true);
      }, 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
    setEvent(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 260 }}
          className="md:hidden fixed left-3 right-3 z-[70] pointer-events-auto"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)",
          }}
        >
          <div className="glass-card glass-card-strong p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden bg-[color:var(--dopl-deep)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/icon-192x192.png"
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">add dopl to your home screen</p>
              {iosFallback ? (
                <p className="text-xs text-[color:var(--dopl-cream)]/60 flex items-center gap-1 mt-0.5">
                  tap
                  <Share size={12} className="inline" />
                  then
                  <span className="font-mono">Add to Home Screen</span>
                </p>
              ) : (
                <p className="text-xs text-[color:var(--dopl-cream)]/60">
                  faster access, works offline
                </p>
              )}
            </div>
            {!iosFallback && (
              <button
                onClick={install}
                className="btn-lime text-xs px-4 py-2 flex items-center gap-1"
              >
                <Plus size={14} />
                install
              </button>
            )}
            <button
              onClick={dismiss}
              aria-label="dismiss"
              className="p-2 text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)]"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
