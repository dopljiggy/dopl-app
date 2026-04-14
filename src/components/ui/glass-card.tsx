"use client";

import { forwardRef, useRef, type HTMLAttributes } from "react";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "light" | "strong";
  glow?: "gain" | "loss" | "gold" | "silver" | "bronze" | null;
  hover?: boolean;
  tilt?: boolean;
};

/**
 * Liquid glass card. Sets CSS vars --mx/--my from pointer for the
 * cursor-following spotlight, and optionally applies a micro 3D tilt.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  function GlassCard(
    {
      variant = "default",
      glow = null,
      hover = true,
      tilt = true,
      className = "",
      onMouseMove,
      onMouseLeave,
      children,
      style,
      ...rest
    },
    ref
  ) {
    const innerRef = useRef<HTMLDivElement | null>(null);
    const setRefs = (el: HTMLDivElement | null) => {
      innerRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
    };

    const base =
      variant === "light"
        ? "glass-card-light"
        : variant === "strong"
        ? "glass-card glass-card-strong"
        : "glass-card";

    const glowClass = glow ? ` glow-${glow}` : "";
    const hoverClass = hover ? " glass-card-hover" : "";

    return (
      <div
        ref={setRefs}
        className={`${base}${glowClass}${hoverClass} ${className}`.trim()}
        style={style}
        onMouseMove={(e) => {
          const el = innerRef.current;
          if (el) {
            const rect = el.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            el.style.setProperty("--mx", `${x}%`);
            el.style.setProperty("--my", `${y}%`);
            // Tilt only on hover-capable pointers (desktop mice, trackpads).
            const canTilt =
              typeof window !== "undefined" &&
              window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
            if (tilt && canTilt && rect.width > 140) {
              const rx = ((y - 50) / 50) * -2.5;
              const ry = ((x - 50) / 50) * 2.5;
              el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
            }
          }
          onMouseMove?.(e);
        }}
        onMouseLeave={(e) => {
          const el = innerRef.current;
          if (el && tilt) el.style.transform = "";
          onMouseLeave?.(e);
        }}
        {...rest}
      >
        {children}
      </div>
    );
  }
);
