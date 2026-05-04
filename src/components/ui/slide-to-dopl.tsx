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
  const [dragging, setDragging] = useState(false);
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

  const fillWidth = useTransform(x, (v) => `${Math.max(0, v + HANDLE - 8)}px`);
  const labelOpacity = useTransform(x, [0, 60], [1, 0]);
  const progress = useTransform(x, (v) =>
    maxDragRef.current > 0 ? v / maxDragRef.current : 0
  );
  const handleGlow = useTransform(
    progress,
    [0, 0.5, 0.7, 1],
    [
      "0 4px 12px -4px rgba(197,214,52,0.3)",
      "0 6px 20px -4px rgba(197,214,52,0.45)",
      "0 8px 28px -4px rgba(197,214,52,0.6)",
      "0 10px 36px -4px rgba(197,214,52,0.75)",
    ]
  );
  const fillOpacity = useTransform(progress, [0, 0.4, 1], [0.4, 0.7, 1]);

  const handleEnd = async () => {
    setDragging(false);
    const max = maxDragRef.current;
    if (!max) return;
    const threshold = max * 0.65;

    if (x.get() >= threshold && !running && !completed) {
      setRunning(true);
      setCompleted(true);
      animate(x, max, {
        type: "spring",
        stiffness: 180,
        damping: 24,
        mass: 0.8,
      });
      if (navigator.vibrate) navigator.vibrate(8);
      try {
        await onComplete();
      } finally {
        setRunning(false);
      }
    } else {
      animate(x, 0, {
        type: "spring",
        stiffness: 200,
        damping: 22,
        mass: 0.6,
      });
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
      {/* Fill gradient — trails the handle with parallax */}
      <motion.div
        className="absolute inset-y-0 left-0 pointer-events-none"
        style={{
          width: fillWidth,
          opacity: fillOpacity,
          borderRadius: 9999,
          background:
            "linear-gradient(90deg, rgba(45,74,62,0.6) 0%, rgba(197,214,52,0.7) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
        }}
      />

      {/* Instructional label */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ opacity: completed ? 0 : labelOpacity }}
      >
        <span className="text-sm font-semibold tracking-wide text-[color:var(--dopl-cream)]/80 flex items-center gap-2">
          {label}
          <motion.span
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowRight size={14} className="opacity-60" />
          </motion.span>
        </span>
      </motion.div>

      {/* Completed label */}
      {completed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
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
        dragElastic={0.08}
        dragMomentum
        dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
        style={{ x }}
        onDragStart={() => setDragging(true)}
        onDragEnd={handleEnd}
        className="absolute top-1 left-1 h-12 w-12 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        initial={false}
        animate={
          completed
            ? { scale: [1, 1.15, 1] }
            : { scale: dragging ? 1.08 : 1 }
        }
        transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <motion.div
          className="h-full w-full rounded-full flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, #D5E456 0%, #C5D634 55%, #a8b82c 100%)",
            boxShadow: handleGlow,
          }}
        >
          {completed ? (
            <motion.span
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
            >
              <Check size={20} color="#0D261F" strokeWidth={3} />
            </motion.span>
          ) : (
            <ArrowRight size={18} color="#0D261F" strokeWidth={2.5} />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
