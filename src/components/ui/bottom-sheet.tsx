"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { X } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const SPRING = { type: "spring" as const, stiffness: 400, damping: 34, mass: 0.8 };

function getSnaps() {
  const h = window.innerHeight;
  return { full: h * 0.1, dismiss: h };
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
}: BottomSheetProps) {
  const sheetY = useMotionValue(
    typeof window !== "undefined" ? window.innerHeight : 800
  );
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const snapRef = useRef<"full">("full");
  const closedRef = useRef(false);

  const drag = useRef({
    active: false,
    startY: 0,
    startSheetY: 0,
    lastY: 0,
    lastTime: 0,
    velocity: 0,
  });
  const scrollDrag = useRef({
    active: false,
    startY: 0,
    wasAtTop: false,
  });

  const snapTo = useCallback(
    (snap: "full" | "dismiss") => {
      const target = getSnaps()[snap];
      if (snap === "dismiss") {
        if (closedRef.current) return;
        closedRef.current = true;
        animate(sheetY, target, { type: "tween", duration: 0.2, ease: [0.4, 0, 1, 1] }).then(
          onClose
        );
      } else {
        animate(sheetY, target, SPRING);
      }
    },
    [sheetY, onClose]
  );

  const dismiss = useCallback(() => snapTo("dismiss"), [snapTo]);

  useEffect(() => {
    if (isOpen) {
      closedRef.current = false;
      const snaps = getSnaps();
      sheetY.set(snaps.dismiss);
      snapRef.current = "full";
      requestAnimationFrame(() => animate(sheetY, snaps.full, SPRING));
    }
  }, [isOpen, sheetY]);

  // Background scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    html.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    const block = (e: TouchEvent) => {
      if (sheetRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", block, { passive: false });
    return () => {
      html.style.overflow = "";
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      window.scrollTo(0, scrollY);
      document.removeEventListener("touchmove", block);
    };
  }, [isOpen]);

  // --- Resolve which snap point to land on ---
  function resolveSnap(velocity: number) {
    const y = sheetY.get();
    const snaps = getSnaps();
    const delta = y - snaps.full;
    const h = window.innerHeight;

    if (delta > 0) {
      if (velocity > 500 || delta > h * 0.15) {
        snapTo("dismiss");
      } else {
        snapTo("full");
      }
    } else {
      snapTo("full");
    }
  }

  // --- Handle drag (pill + header zone) ---
  const onHandleDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      active: true,
      startY: e.clientY,
      startSheetY: sheetY.get(),
      lastY: e.clientY,
      lastTime: Date.now(),
      velocity: 0,
    };
  };

  const onHandleMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const newY = d.startSheetY + (e.clientY - d.startY);
    const snaps = getSnaps();
    sheetY.set(Math.max(snaps.full - 40, Math.min(snaps.dismiss, newY)));
    const now = Date.now();
    const dt = now - d.lastTime;
    if (dt > 0) {
      d.velocity = ((e.clientY - d.lastY) / dt) * 1000;
      d.lastY = e.clientY;
      d.lastTime = now;
    }
  };

  const onHandleUp = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    resolveSnap(drag.current.velocity);
  };

  // --- Scroll-to-drag handoff (pull down from scroll top → drag sheet) ---
  const onScrollTouchStart = (e: React.TouchEvent) => {
    scrollDrag.current = {
      active: false,
      startY: e.touches[0].clientY,
      wasAtTop: (scrollRef.current?.scrollTop ?? 0) <= 0,
    };
  };

  const onScrollTouchMove = (e: React.TouchEvent) => {
    const sd = scrollDrag.current;
    const touchY = e.touches[0].clientY;
    const dy = touchY - sd.startY;

    // Pull-down from scroll top transitions to drag
    if (!sd.active && sd.wasAtTop && dy > 8 && (scrollRef.current?.scrollTop ?? 0) <= 0) {
      sd.active = true;
      drag.current = {
        active: true,
        startY: touchY,
        startSheetY: sheetY.get(),
        lastY: touchY,
        lastTime: Date.now(),
        velocity: 0,
      };
    }

    if (sd.active) {
      e.preventDefault();
      const newY = drag.current.startSheetY + (touchY - drag.current.startY);
      const snaps = getSnaps();
      sheetY.set(Math.max(snaps.full - 40, Math.min(snaps.dismiss, newY)));
      const now = Date.now();
      const dt = now - drag.current.lastTime;
      if (dt > 0) {
        drag.current.velocity = ((touchY - drag.current.lastY) / dt) * 1000;
        drag.current.lastY = touchY;
        drag.current.lastTime = now;
      }
    }
  };

  const onScrollTouchEnd = () => {
    if (scrollDrag.current.active) {
      scrollDrag.current.active = false;
      drag.current.active = false;
      resolveSnap(drag.current.velocity);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="xl:hidden">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[70]"
        style={{ background: "rgba(13, 38, 31, 0.5)", backdropFilter: "blur(4px)" }}
        onClick={dismiss}
      />

      {/* Sheet — full viewport height, translateY controls visible portion */}
      <motion.div
        ref={sheetRef}
        style={{
          y: sheetY,
          background: "linear-gradient(180deg, #0D261F 0%, #0a1f19 100%)",
          borderTop: "1px solid rgba(243, 239, 232, 0.08)",
          boxShadow: "0 -8px 30px -8px rgba(0,0,0,0.4)",
          borderRadius: "20px 20px 0 0",
          height: "100dvh",
        }}
        className="fixed inset-x-0 top-0 z-[71] flex flex-col overflow-hidden"
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-4 right-4 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent 10%, rgba(197,214,52,0.35) 50%, transparent 90%)",
          }}
        />

        {/* Drag handle zone */}
        <div
          className="flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: "none" }}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-[color:var(--dopl-cream)]/25" />
          </div>
          <div className="flex items-center justify-between px-5 pb-4">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-lg font-semibold">{title}</h2>
              {subtitle && (
                <span className="text-xs text-[color:var(--dopl-cream)]/40 font-mono">
                  {subtitle}
                </span>
              )}
            </div>
            <button
              onClick={dismiss}
              className="p-1.5 rounded-lg text-[color:var(--dopl-cream)]/40 hover:text-[color:var(--dopl-cream)] hover:bg-[color:var(--dopl-sage)]/30 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 px-5 pb-4"
          style={{
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
          onTouchStart={onScrollTouchStart}
          onTouchMove={onScrollTouchMove}
          onTouchEnd={onScrollTouchEnd}
        >
          {children}
        </div>
      </motion.div>
    </div>
  );
}
