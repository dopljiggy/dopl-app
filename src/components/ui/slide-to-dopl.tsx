"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";

type Props = {
  label?: string;
  completedLabel?: string;
  onComplete: () => void | Promise<void>;
  disabled?: boolean;
};

const HANDLE = 48;
const PAD = 4;

export default function SlideToDopl({
  label = "slide to dopl",
  completedLabel = "dopl'd",
  onComplete,
  disabled,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const maxDragRef = useRef(0);
  const [completed, setCompleted] = useState(false);
  const [running, setRunning] = useState(false);
  const x = useMotionValue(0);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      maxDragRef.current = el.offsetWidth - HANDLE - PAD * 2;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fillWidth = useTransform(x, (v) => `${v + HANDLE}px`);
  const labelOpacity = useTransform(x, [0, 80], [1, 0]);

  const handleEnd = async () => {
    const max = maxDragRef.current;
    if (!max) return;
    const threshold = max * 0.75;

    if (x.get() >= threshold && !running && !completed) {
      setRunning(true);
      animate(x, max, { type: "spring", stiffness: 300, damping: 28 });
      if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
      try {
        await onComplete();
        setCompleted(true);
      } finally {
        setRunning(false);
      }
    } else {
      animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
    }
  };

  return (
    <div
      ref={trackRef}
      className={`relative h-14 w-full select-none ${
        disabled ? "opacity-50 pointer-events-none" : ""
      }`}
      style={{
        borderRadius: 9999,
        background:
          "linear-gradient(180deg, rgba(45,74,62,0.35), rgba(45,74,62,0.15))",
        border: "1px solid var(--glass-border)",
        overflow: "hidden",
        touchAction: "none",
      }}
    >
      {/* Fill gradient */}
      <motion.div
        className="absolute inset-y-0 left-0 pointer-events-none"
        style={{
          width: fillWidth,
          borderRadius: 9999,
          background:
            "linear-gradient(90deg, rgba(45,74,62,0.7) 0%, rgba(197,214,52,0.65) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      />

      {/* Instructional label */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ opacity: completed ? 0 : labelOpacity }}
      >
        <span className="text-sm font-semibold tracking-wide text-[color:var(--dopl-cream)]/80 flex items-center gap-2">
          {label}
          <ArrowRight size={14} className="opacity-60" />
        </span>
      </motion.div>

      {/* Completed label */}
      {completed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <span className="text-sm font-semibold text-[color:var(--dopl-deep)]">
            {completedLabel}
          </span>
        </motion.div>
      )}

      {/* Handle */}
      <motion.div
        drag={completed || running ? false : "x"}
        dragConstraints={trackRef}
        dragElastic={0.05}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={handleEnd}
        className="absolute top-1 left-1 h-12 w-12 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        initial={false}
        animate={
          completed
            ? { scale: [1, 1.18, 1] }
            : { scale: 1 }
        }
        transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <div
          className="h-full w-full rounded-full flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, #D5E456 0%, #C5D634 55%, #a8b82c 100%)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(197,214,52,0.5), 0 0 0 1px rgba(0,0,0,0.15)",
          }}
        >
          {completed ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
            >
              <Check size={20} color="#0D261F" strokeWidth={3} />
            </motion.span>
          ) : (
            <ArrowRight size={18} color="#0D261F" strokeWidth={2.5} />
          )}
        </div>
      </motion.div>
    </div>
  );
}
