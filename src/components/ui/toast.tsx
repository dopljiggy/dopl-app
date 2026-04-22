"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, TrendingUp } from "lucide-react";

export type Toast = {
  id: string;
  title: string;
  body?: string;
  avatarLetter?: string;
  href?: string;
};

type ToastCtx = {
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback<ToastCtx["push"]>(
    (t) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((ts) => [{ id, ...t }, ...ts].slice(0, 4));
      // auto-dismiss
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  // Listen to a window event so server-driven flows can show toasts
  // without prop-drilling.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Omit<Toast, "id">>).detail;
      if (detail?.title) push(detail);
    };
    window.addEventListener("dopl:toast", handler as EventListener);
    return () => window.removeEventListener("dopl:toast", handler as EventListener);
  }, [push]);

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed top-20 right-4 z-[90] flex flex-col gap-2 pointer-events-none w-[min(360px,calc(100vw-2rem))]">
        <AnimatePresence initial={false}>
          {toasts.map((t, i) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.96 }}
              animate={{
                opacity: 1,
                x: 0,
                scale: 1 - i * 0.02,
                y: i * -2,
              }}
              exit={{ opacity: 0, x: 60, scale: 0.96 }}
              transition={{ type: "spring", damping: 22, stiffness: 240 }}
              className="glass-card glass-card-strong p-4 pointer-events-auto cursor-pointer relative"
              onClick={() => {
                if (t.href) window.location.href = t.href;
                dismiss(t.id);
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-dopl-sage flex items-center justify-center font-display text-dopl-lime text-sm flex-shrink-0">
                  {t.avatarLetter ? t.avatarLetter.toUpperCase() : <TrendingUp size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{t.title}</p>
                  {t.body && (
                    <p className="text-xs text-[color:var(--dopl-cream)]/55 mt-0.5 line-clamp-2">
                      {t.body}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss(t.id);
                  }}
                  className="text-[color:var(--dopl-cream)]/40 hover:text-[color:var(--dopl-cream)]"
                  aria-label="dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

/** Fire-and-forget helper for code outside React. */
export function fireToast(t: Omit<Toast, "id">) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("dopl:toast", { detail: t }));
  }
}
