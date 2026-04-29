"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

type LoadingCtx = {
  start: (tag?: string) => void;
  stop: (tag?: string) => void;
  isLoading: boolean;
};

const Ctx = createContext<LoadingCtx | null>(null);

export function useLoading() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLoading must be used inside <LoadingProvider>");
  return ctx;
}

/**
 * Wraps fetch so any network request triggers the aurora. Tracks in-flight
 * count so the overlay stays on while anything is pending.
 */
export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  const tagsRef = useRef<Set<string>>(new Set());
  const pathTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback((tag?: string) => {
    if (tag) {
      if (tagsRef.current.has(tag)) return;
      tagsRef.current.add(tag);
    }
    setCount((c) => c + 1);
  }, []);

  const stop = useCallback((tag?: string) => {
    if (tag) {
      if (!tagsRef.current.has(tag)) return;
      tagsRef.current.delete(tag);
    }
    setCount((c) => Math.max(0, c - 1));
  }, []);

  // Trigger a brief aurora on every route change. Skeleton loading.tsx
  // files cover the meaty initial-render case, so this is just a tail
  // shimmer for fast in-app navigations.
  useEffect(() => {
    start("nav");
    if (pathTimer.current) clearTimeout(pathTimer.current);
    pathTimer.current = setTimeout(() => stop("nav"), 150);
    return () => {
      if (pathTimer.current) clearTimeout(pathTimer.current);
    };
  }, [pathname, start, stop]);

  // Patch window.fetch with a start-delay pattern: only show the aurora
  // if the request is still pending after 150ms. Sub-150ms requests
  // (the bulk of API calls in normal usage) show no spinner at all,
  // which avoids the flicker the previous 200ms post-extension caused
  // (CSS opacity 420ms ramp would barely begin then immediately reverse).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const orig = window.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__origFetch ??= orig;
    window.fetch = async (...args) => {
      let started = false;
      const timer = setTimeout(() => {
        started = true;
        start();
      }, 150);
      try {
        return await orig(...args);
      } finally {
        clearTimeout(timer);
        if (started) stop();
      }
    };
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.fetch = (window as any).__origFetch ?? orig;
    };
  }, [start, stop]);

  const value = useMemo<LoadingCtx>(
    () => ({ start, stop, isLoading: count > 0 }),
    [start, stop, count]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <AuroraOverlay active={count > 0} />
      <TopBar active={count > 0} />
    </Ctx.Provider>
  );
}

function AuroraOverlay({ active }: { active: boolean }) {
  return <div className={`aurora-overlay${active ? " active" : ""}`} aria-hidden />;
}

function TopBar({ active }: { active: boolean }) {
  return <div className={`loading-bar${active ? " active" : ""}`} aria-hidden />;
}
