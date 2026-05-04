"use client";

import { useState, useRef, useEffect } from "react";
import { Copy, Download, Share2, Check } from "lucide-react";
import { motion } from "framer-motion";

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
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const shareUrl = `${origin}/${handle}`;

  // Any share action (copy, download, X) flips the dashboard's
  // "share your dopl link" checklist item to done. localStorage-based
  // so it survives across dashboard visits without a DB write.
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

  const downloadPng = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { toBlob } = await import("html-to-image");
      // The preview card renders at 540px. Export at 1200x630 (2.22× scale
      // locks the proportions to the Twitter / OG standard).
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2.222,
        canvasWidth: 1200,
        canvasHeight: 630,
      });
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dopl-${handle}.png`;
      a.click();
      URL.revokeObjectURL(url);
      markShared();
    } catch {
      window.open(`${origin}/api/share-card/${handle}`, "_blank");
      markShared();
    } finally {
      setDownloading(false);
    }
  };

  const shareOnX = () => {
    const text = encodeURIComponent(`follow my portfolio on dopl`);
    const url = encodeURIComponent(shareUrl);
    // Canonical X web intent is /intent/tweet (verified 2026-04). The
    // /intent/post variant used in Sprint 4 R1 returns X's error page.
    // NOTE: do NOT pass "noopener,noreferrer" in the features string —
    // per WHATWG spec window.open returns null when noopener is set,
    // which would force the fallback same-tab nav and close the dashboard.
    const intent = `https://x.com/intent/tweet?text=${text}&url=${url}`;
    const popup = window.open(intent, "_blank");
    if (popup) {
      try {
        popup.opener = null;
      } catch {
        /* cross-origin — ignore */
      }
    } else {
      window.location.href = intent;
    }
    markShared();
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
    <div>
      <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-10">
        Share
      </h1>

      <div className="grid lg:grid-cols-[auto,300px] gap-8 items-start">
        <div>
          <p className="text-[10px] text-[color:var(--dopl-cream)]/40 mb-3 uppercase tracking-[0.2em] font-mono">
            preview
          </p>

          {/* Floating pedestal — wrapper measures available width for scaling */}
          <div ref={wrapperRef} style={{ maxWidth: CARD_W, width: "100%" }}>
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative"
            >
              <div style={{ height: (CARD_H + 2) * cardScale }}>
                <div
                  style={{
                    transform: `scale(${cardScale})`,
                    transformOrigin: "top left",
                  }}
                >
                  {/* Animated gradient border shell */}
                  <div
                    className="share-card-shell"
                    style={{ borderRadius: 22, padding: 1 }}
                  >
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
                  fontFamily:
                    "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
                  // Layered background: radial vignette + linear wash
                  background:
                    "radial-gradient(110% 120% at 50% 30%, #152E26 0%, #0E241D 55%, #0A1F18 100%)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  boxShadow:
                    "inset 0 1px 0 rgba(197,214,52,0.10), 0 20px 60px rgba(0,0,0,0.4), 0 0 80px rgba(197,214,52,0.08)",
                }}
              >
                {/* Grid / noise overlay */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    opacity: 0.03,
                    backgroundImage:
                      "linear-gradient(rgba(243,239,232,1) 1px, transparent 1px), linear-gradient(90deg, rgba(243,239,232,1) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                  }}
                />
                {/* Soft top-right lime ambient */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: -90,
                    right: -80,
                    width: 260,
                    height: 260,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(circle, rgba(197,214,52,0.22) 0%, transparent 65%)",
                    pointerEvents: "none",
                  }}
                />

                {/* Top row: avatar + name */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    marginBottom: 18,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 18,
                      background:
                        "linear-gradient(135deg, #2D4A3E 0%, #1e372d 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 30,
                      fontWeight: 600,
                      color: "#C5D634",
                      fontFamily:
                        "'Fraunces', ui-serif, Georgia, Cambria, serif",
                      border: "2px solid rgba(197,214,52,0.30)",
                      boxShadow:
                        "0 0 20px rgba(197,214,52,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
                      flexShrink: 0,
                    }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 700,
                        lineHeight: 1.1,
                        color: "#F3EFE8",
                        fontFamily:
                          "'Fraunces', ui-serif, Georgia, Cambria, serif",
                        letterSpacing: "-0.01em",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {displayName}
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        color: "rgba(197,214,52,0.70)",
                        fontFamily:
                          "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                        marginTop: 2,
                      }}
                    >
                      @{handle}
                    </div>
                  </div>
                </div>

                {/* Portfolio tags */}
                {portfolioNames.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 20,
                      position: "relative",
                    }}
                  >
                    {portfolioNames.slice(0, 3).map((name, i) => (
                      <span
                        key={i}
                        style={{
                          background: "rgba(45,74,62,0.60)",
                          backdropFilter: "blur(10px)",
                          WebkitBackdropFilter: "blur(10px)",
                          border: "1px solid rgba(197,214,52,0.15)",
                          color: "rgba(243,239,232,0.90)",
                          fontSize: 12,
                          padding: "6px 16px",
                          borderRadius: 20,
                          fontWeight: 500,
                          letterSpacing: "0.01em",
                        }}
                      >
                        {name}
                      </span>
                    ))}
                    {portfolioNames.length > 3 && (
                      <span
                        style={{
                          color: "rgba(243,239,232,0.45)",
                          fontSize: 12,
                          padding: "6px 4px",
                          fontFamily:
                            "'JetBrains Mono', ui-monospace, monospace",
                        }}
                      >
                        +{portfolioNames.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Stats row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 28,
                    marginBottom: 18,
                    position: "relative",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 32,
                        fontWeight: 700,
                        color: "#C5D634",
                        fontFamily:
                          "'JetBrains Mono', ui-monospace, monospace",
                        lineHeight: 1,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {subscriberCount}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(243,239,232,0.40)",
                        textTransform: "uppercase",
                        letterSpacing: "0.18em",
                        marginTop: 6,
                        fontFamily:
                          "'JetBrains Mono', ui-monospace, monospace",
                      }}
                    >
                      doplers
                    </div>
                  </div>
                  <div
                    aria-hidden
                    style={{
                      width: 1,
                      height: 32,
                      background:
                        "linear-gradient(180deg, transparent, rgba(197,214,52,0.25), transparent)",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 32,
                        fontWeight: 700,
                        color: "#F3EFE8",
                        fontFamily:
                          "'JetBrains Mono', ui-monospace, monospace",
                        lineHeight: 1,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {portfolioNames.length}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(243,239,232,0.40)",
                        textTransform: "uppercase",
                        letterSpacing: "0.18em",
                        marginTop: 6,
                        fontFamily:
                          "'JetBrains Mono', ui-monospace, monospace",
                      }}
                    >
                      portfolios
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div
                  style={{
                    position: "absolute",
                    left: 28,
                    right: 28,
                    bottom: 22,
                    paddingTop: 14,
                    borderTop: "1px solid rgba(197,214,52,0.10)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: "rgba(197,214,52,0.50)",
                      fontFamily:
                        "'JetBrains Mono', ui-monospace, monospace",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {origin.replace(/^https?:\/\//, "")}/{handle}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      color: "rgba(243,239,232,0.45)",
                      textTransform: "uppercase",
                      letterSpacing: "0.18em",
                      fontFamily:
                        "'JetBrains Mono', ui-monospace, monospace",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        background: "#C5D634",
                        color: "#0D261F",
                        fontFamily:
                          "'Fraunces', ui-serif, Georgia, Cambria, serif",
                        fontWeight: 700,
                        fontSize: 11,
                        lineHeight: 1,
                      }}
                    >
                      d
                    </span>
                    powered by dopl
                  </div>
                </div>
              </div>
            </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Action panel */}
        <div className="w-full lg:w-auto">
          <p className="text-[10px] text-[color:var(--dopl-cream)]/40 mb-3 uppercase tracking-[0.2em] font-mono">
            actions
          </p>
          <div className="space-y-3">
            <ActionButton
              icon={copied ? <Check size={16} /> : <Copy size={16} />}
              title={copied ? "Copied!" : "Copy Link"}
              onClick={copyLink}
            />
            <ActionButton
              icon={<Download size={16} />}
              title={downloading ? "Rendering..." : "Download PNG"}
              onClick={downloadPng}
              disabled={downloading}
            />
            <ActionButton
              icon={<Share2 size={16} />}
              title="Share On X"
              onClick={shareOnX}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        .share-card-shell {
          position: relative;
          background: linear-gradient(
            135deg,
            rgba(45, 74, 62, 0.9) 0%,
            rgba(197, 214, 52, 0.55) 50%,
            rgba(45, 74, 62, 0.9) 100%
          );
          background-size: 220% 220%;
          animation: share-border-shift 9s ease-in-out infinite;
        }
        @keyframes share-border-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </div>
  );
}

function ActionButton({
  icon,
  title,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="glass-card group relative w-full text-left p-4 rounded-xl overflow-hidden border border-[color:var(--glass-border)] hover:border-[color:var(--dopl-lime)]/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span
        aria-hidden
        className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full bg-[color:var(--dopl-lime)]/40 group-hover:bg-[color:var(--dopl-lime)] transition-colors"
      />
      <div className="flex items-center gap-3 pl-2">
        <div className="w-9 h-9 rounded-lg bg-[color:var(--dopl-lime)]/10 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] shrink-0 group-hover:bg-[color:var(--dopl-lime)]/15 transition-colors">
          {icon}
        </div>
        <p className="text-sm font-semibold truncate">{title}</p>
      </div>
    </motion.button>
  );
}
