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

type LogoStage = "coincap" | "fmp" | "fallback";

export function StockLogo({
  ticker,
  size = 32,
  className = "",
}: {
  ticker: string;
  size?: number;
  className?: string;
}) {
  const [stage, setStage] = useState<LogoStage>("coincap");
  const symbol = ticker.trim().toUpperCase();

  if (stage === "fallback") {
    return (
      <div
        className={`rounded-full flex items-center justify-center font-mono font-bold text-[color:var(--dopl-deep)] flex-shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.45,
          backgroundColor: letterColor(symbol),
        }}
      >
        {symbol[0]}
      </div>
    );
  }

  const src =
    stage === "coincap"
      ? `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`
      : `https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() =>
        setStage((prev) => (prev === "coincap" ? "fmp" : "fallback"))
      }
      className={`rounded-full object-contain flex-shrink-0 bg-[color:var(--dopl-sage)]/30 ${className}`}
    />
  );
}
