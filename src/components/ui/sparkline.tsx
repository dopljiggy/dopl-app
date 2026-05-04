"use client";

import { motion } from "framer-motion";

/**
 * Tiny inline trendline. Accepts an array of numbers, renders an SVG path
 * that animates in. Designed for stat card backgrounds.
 */
export default function Sparkline({
  data,
  width = 120,
  height = 36,
  color = "var(--dopl-lime)",
  className = "",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (!data || data.length < 2) return null;

  // Hide entirely on flat/no-data series — a brand-new FM has all-zero
  // sparklines, and the ramp-up animation made the empty stat cards
  // look like a chart artifact rather than an empty state.
  const max = Math.max(...data);
  const min = Math.min(...data);
  if (max === 0 && min === 0) return null;

  const range = max - min || 1;
  // Inset so the path strokes don't bleed to the card edge — the prior
  // viewBox terminated paths at x=0 / x=width which produced a thin
  // visible 'line at the edge' artifact on the dashboard stat cards.
  const inset = 4;
  const innerWidth = Math.max(1, width - inset * 2);
  const innerHeight = Math.max(1, height - inset * 2);
  const step = innerWidth / (data.length - 1);

  const points = data.map((v, i) => {
    const x = inset + i * step;
    const y = inset + innerHeight - ((v - min) / range) * innerHeight;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => (i === 0 ? `M ${x},${y}` : `L ${x},${y}`))
    .join(" ");

  const areaPath = `${linePath} L ${inset + innerWidth},${inset + innerHeight} L ${inset},${inset + innerHeight} Z`;

  const gradId = `spark-${Math.random().toString(36).slice(2, 9)}`;
  const clipId = `spark-clip-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect
            x={inset}
            y={inset}
            width={innerWidth}
            height={innerHeight}
          />
        </clipPath>
      </defs>
      <motion.path
        d={areaPath}
        fill={`url(#${gradId})`}
        clipPath={`url(#${clipId})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.1, ease: [0.2, 0.7, 0.2, 1] }}
      />
    </svg>
  );
}
