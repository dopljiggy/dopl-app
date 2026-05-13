"use client";

import { useState } from "react";

const COLORS = [
  "#C5D634", "#a8b82c", "#8cc9a4", "#6fa686",
  "#4f7862", "#2D4A3E", "#5b8a72", "#3d6b5a",
];

function letterColor(ticker: string) {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function StockLogo({
  ticker,
  size = 24,
  className = "",
}: {
  ticker: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`rounded-md flex items-center justify-center font-mono font-bold text-[color:var(--dopl-deep)] flex-shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.5,
          backgroundColor: letterColor(ticker),
        }}
      >
        {ticker[0]}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://financialmodelingprep.com/image-stock/${encodeURIComponent(ticker)}.png`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`rounded-md object-contain flex-shrink-0 ${className}`}
    />
  );
}
