"use client";

import { useState, useRef, useEffect } from "react";
import { Copy, Check } from "lucide-react";


interface Props {
  handle: string;
  displayName: string;
  subscriberCount: number;
  portfolioNames: string[];
  origin: string;
}

export default function ShareClient({
  handle,
  displayName,
  subscriberCount,
  portfolioNames,
  origin,
}: Props) {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const shareUrl = `${origin}/${handle}`;

  const markShared = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dopl_shared", "1");
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    markShared();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [sharing, setSharing] = useState(false);

  const shareDopl = async () => {
    if (!navigator.share) {
      copyLink();
      return;
    }
    setSharing(true);
    try {
      let files: File[] | undefined;
      if (cardRef.current && navigator.canShare?.({ files: [new File([], "t.png", { type: "image/png" })] })) {
        const { toBlob } = await import("html-to-image");
        const blob = await toBlob(cardRef.current, {
          pixelRatio: 2.222,
          canvasWidth: 1200,
          canvasHeight: 630,
        });
        if (blob) {
          files = [new File([blob], `dopl-${handle}.png`, { type: "image/png" })];
        }
      }
      await navigator.share({
        ...(files ? { files } : {}),
        title: `${displayName} on dopl`,
        text: `follow my portfolio on dopl\n${shareUrl}`,
      });
      markShared();
    } catch {
      /* user cancelled or share failed */
    } finally {
      setSharing(false);
    }
  };

  const CARD_W = 540;
  const CARD_H = 283;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [cardScale, setCardScale] = useState(1);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setCardScale(Math.min(1, entry.contentRect.width / CARD_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-8 text-center">
        Share
      </h1>

      {/* Card preview */}
      <div ref={wrapperRef} className="w-full mx-auto" style={{ maxWidth: CARD_W, marginBottom: 48 }}>
        <div className="relative">
          <div style={{ height: (CARD_H + 2) * cardScale }}>
            <div style={{ transform: `scale(${cardScale})`, transformOrigin: "top left" }}>
              <div className="share-card-shell" style={{ borderRadius: 22, padding: 1 }}>
                <div
                  ref={cardRef}
                  style={{
                    width: CARD_W,
                    height: CARD_H,
                    borderRadius: 20,
                    padding: 28,
                    position: "relative",
                    overflow: "hidden",
                    color: "#F3EFE8",
                    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
                    background: "radial-gradient(110% 120% at 50% 30%, #152E26 0%, #0E241D 55%, #0A1F18 100%)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    boxShadow: "inset 0 1px 0 rgba(197,214,52,0.10), 0 20px 60px rgba(0,0,0,0.4), 0 0 80px rgba(197,214,52,0.08)",
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.03,
                      backgroundImage: "linear-gradient(rgba(243,239,232,1) 1px, transparent 1px), linear-gradient(90deg, rgba(243,239,232,1) 1px, transparent 1px)",
                      backgroundSize: "22px 22px",
                    }}
                  />
                  <div
                    aria-hidden
                    style={{
                      position: "absolute", top: -90, right: -80, width: 260, height: 260, borderRadius: "50%",
                      background: "radial-gradient(circle, rgba(197,214,52,0.22) 0%, transparent 65%)",
                      pointerEvents: "none",
                    }}
                  />

                  <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18, position: "relative" }}>
                    <div
                      style={{
                        width: 72, height: 72, borderRadius: 18,
                        background: "linear-gradient(135deg, #2D4A3E 0%, #1e372d 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 30, fontWeight: 600, color: "#C5D634",
                        fontFamily: "'Fraunces', ui-serif, Georgia, Cambria, serif",
                        border: "2px solid rgba(197,214,52,0.30)",
                        boxShadow: "0 0 20px rgba(197,214,52,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
                        flexShrink: 0,
                      }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 28, fontWeight: 700, lineHeight: 1.1, color: "#F3EFE8",
                        fontFamily: "'Fraunces', ui-serif, Georgia, Cambria, serif",
                        letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {displayName}
                      </div>
                      <div style={{
                        fontSize: 15, color: "rgba(197,214,52,0.70)",
                        fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                        marginTop: 2,
                      }}>
                        @{handle}
                      </div>
                    </div>
                  </div>

                  {portfolioNames.length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20, position: "relative" }}>
                      {portfolioNames.slice(0, 3).map((name, i) => (
                        <span key={i} style={{
                          background: "rgba(45,74,62,0.60)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                          border: "1px solid rgba(197,214,52,0.15)", color: "rgba(243,239,232,0.90)",
                          fontSize: 12, padding: "6px 16px", borderRadius: 20, fontWeight: 500, letterSpacing: "0.01em",
                        }}>
                          {name}
                        </span>
                      ))}
                      {portfolioNames.length > 3 && (
                        <span style={{
                          color: "rgba(243,239,232,0.45)", fontSize: 12, padding: "6px 4px",
                          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        }}>
                          +{portfolioNames.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 18, position: "relative" }}>
                    <div>
                      <div style={{
                        fontSize: 32, fontWeight: 700, color: "#C5D634",
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        lineHeight: 1, letterSpacing: "-0.01em",
                      }}>
                        {subscriberCount}
                      </div>
                      <div style={{
                        fontSize: 11, color: "rgba(243,239,232,0.40)", textTransform: "uppercase",
                        letterSpacing: "0.18em", marginTop: 6,
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      }}>
                        doplers
                      </div>
                    </div>
                    <div aria-hidden style={{
                      width: 1, height: 32,
                      background: "linear-gradient(180deg, transparent, rgba(197,214,52,0.25), transparent)",
                    }} />
                    <div>
                      <div style={{
                        fontSize: 32, fontWeight: 700, color: "#F3EFE8",
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        lineHeight: 1, letterSpacing: "-0.01em",
                      }}>
                        {portfolioNames.length}
                      </div>
                      <div style={{
                        fontSize: 11, color: "rgba(243,239,232,0.40)", textTransform: "uppercase",
                        letterSpacing: "0.18em", marginTop: 6,
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      }}>
                        portfolios
                      </div>
                    </div>
                  </div>

                  <div style={{
                    position: "absolute", left: 28, right: 28, bottom: 22, paddingTop: 14,
                    borderTop: "1px solid rgba(197,214,52,0.10)",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  }}>
                    <div style={{
                      fontSize: 13, color: "rgba(197,214,52,0.50)",
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {origin.replace(/^https?:\/\//, "")}/{handle}
                    </div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      fontSize: 11, color: "rgba(243,239,232,0.45)", textTransform: "uppercase",
                      letterSpacing: "0.18em",
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 16, height: 16, borderRadius: 4, background: "#C5D634", color: "#0D261F",
                        fontFamily: "'Fraunces', ui-serif, Georgia, Cambria, serif",
                        fontWeight: 700, fontSize: 11, lineHeight: 1,
                      }}>
                        d
                      </span>
                      powered by dopl
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Link bar */}
      <div className="flex items-center gap-2 mb-8 mx-auto" style={{ maxWidth: CARD_W }}>
        <div className="flex-1 min-w-0 rounded-xl glass-card-light px-4 py-3 flex items-center gap-2">
          <span className="text-xs text-[color:var(--dopl-cream)]/40 flex-shrink-0">
            <Copy size={14} />
          </span>
          <span className="text-sm font-mono text-[color:var(--dopl-cream)]/70 truncate">
            {shareUrl.replace(/^https?:\/\//, "")}
          </span>
        </div>
        <button
          onClick={copyLink}
          className="rounded-xl glass-card-light px-4 py-3 text-sm font-semibold hover:bg-[color:var(--dopl-sage)]/40 transition-colors flex-shrink-0"
        >
          {copied ? (
            <span className="flex items-center gap-1.5 text-[color:var(--dopl-lime)]">
              <Check size={14} /> Copied
            </span>
          ) : (
            "Copy"
          )}
        </button>
      </div>

      {/* Single share button */}
      <div className="mx-auto" style={{ maxWidth: CARD_W }}>
        <button
          onClick={shareDopl}
          disabled={sharing}
          className="w-full btn-lime text-base font-semibold py-4 rounded-xl disabled:opacity-70"
        >
          {sharing ? "preparing..." : "share"}
        </button>
      </div>

      <style jsx>{`
        .share-card-shell {
          position: relative;
          background: linear-gradient(135deg, rgba(45,74,62,0.9) 0%, rgba(197,214,52,0.55) 50%, rgba(45,74,62,0.9) 100%);
          background-size: 220% 220%;
          animation: share-border-shift 9s ease-in-out infinite;
        }
        @keyframes share-border-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}
