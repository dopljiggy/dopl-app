"use client";

import { useState, useRef } from "react";

interface Props {
  handle: string;
  displayName: string;
  subscriberCount: number;
  portfolioNames: string[];
  origin: string;
}

export default function ShareClient({ handle, displayName, subscriberCount, portfolioNames, origin }: Props) {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const shareUrl = `${origin}/${handle}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPng = async () => {
    try {
      const { toBlob } = await import("html-to-image");
      if (!cardRef.current) return;
      const blob = await toBlob(cardRef.current, { pixelRatio: 2 });
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dopl-${handle}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: try server-side generation
      window.open(`${origin}/api/share-card/${handle}`, "_blank");
    }
  };

  const shareOnX = () => {
    const text = encodeURIComponent(`follow my portfolio on dopl`);
    const url = encodeURIComponent(shareUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-2">share</h1>
      <p className="text-[color:var(--dopl-cream)]/50 text-sm mb-8">download a premium card and drop it anywhere</p>

      <div className="grid md:grid-cols-[1fr,300px] gap-8">
        <div>
          <p className="text-xs text-[color:var(--dopl-cream)]/40 mb-3 uppercase tracking-wider">preview</p>
          <div ref={cardRef} style={{ background: "linear-gradient(135deg, #0D261F 0%, #1a3d32 100%)", borderRadius: 16, padding: 32, maxWidth: 500 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "#2D4A3E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 600, color: "#C5D634" }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 600, color: "#F3EFE8" }}>{displayName}</div>
                <div style={{ fontSize: 14, color: "#F3EFE880" }}>@{handle}</div>
              </div>
            </div>
            {portfolioNames.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                {portfolioNames.map((name, i) => (
                  <span key={i} style={{ background: "#2D4A3E", color: "#F3EFE8", fontSize: 12, padding: "4px 12px", borderRadius: 6 }}>{name}</span>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 32, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#C5D634", fontFamily: "JetBrains Mono" }}>{subscriberCount}</div>
                <div style={{ fontSize: 11, color: "#F3EFE860", textTransform: "uppercase", letterSpacing: 1 }}>doplers</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#F3EFE8", fontFamily: "JetBrains Mono" }}>{portfolioNames.length}</div>
                <div style={{ fontSize: 11, color: "#F3EFE860", textTransform: "uppercase", letterSpacing: 1 }}>portfolios</div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #2D4A3E", paddingTop: 12, fontSize: 12, color: "#F3EFE840", fontFamily: "JetBrains Mono" }}>
              {origin.replace("https://", "")}/{handle} · powered by dopl
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs text-[color:var(--dopl-cream)]/40 mb-3 uppercase tracking-wider">actions</p>
          <div className="space-y-3">
            <button onClick={copyLink} className="glass-card p-4 w-full text-left hover:border-[#C5D634]/30 transition-colors">
              <p className="text-sm font-semibold">{copied ? "copied!" : "copy link"}</p>
              <p className="text-xs text-[color:var(--dopl-cream)]/40">{shareUrl.replace("https://", "")}</p>
            </button>
            <button onClick={downloadPng} className="glass-card p-4 w-full text-left hover:border-[#C5D634]/30 transition-colors">
              <p className="text-sm font-semibold">download PNG</p>
              <p className="text-xs text-[color:var(--dopl-cream)]/40">save card as image</p>
            </button>
            <button onClick={shareOnX} className="glass-card p-4 w-full text-left hover:border-[#C5D634]/30 transition-colors">
              <p className="text-sm font-semibold">share on X</p>
              <p className="text-xs text-[color:var(--dopl-cream)]/40">opens tweet composer</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
