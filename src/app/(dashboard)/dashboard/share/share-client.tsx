"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Share2, Download, Copy, Check } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import CountUp from "@/components/ui/count-up";

export default function ShareClient({
  handle,
  displayName,
  avatarUrl,
  subscriberCount,
  portfolioCount,
}: {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  subscriberCount: number;
  portfolioCount: number;
}) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined" && handle
      ? `${window.location.origin}/${handle}`
      : `dopl.com/${handle}`;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    if (!handle) return;
    const a = document.createElement("a");
    a.href = `/api/share-card/${handle}`;
    a.download = `${handle}-dopl.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const shareOnX = () => {
    const text = `i'm now on dopl. follow my portfolio live: ${url}`;
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank"
    );
  };

  if (!handle) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold mb-2">share</h1>
        <GlassCard className="p-12 text-center max-w-lg">
          <p className="text-[color:var(--dopl-cream)]/60 mb-4">
            set your handle in profile first to get a shareable link
          </p>
          <a
            href="/dashboard/profile"
            className="btn-lime text-sm px-6 py-2.5"
          >
            edit profile
          </a>
        </GlassCard>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-2">share</h1>
      <p className="text-[color:var(--dopl-cream)]/50 text-sm mb-8">
        download a premium card and drop it anywhere
      </p>

      <div className="grid md:grid-cols-5 gap-6">
        {/* Premium trading card preview */}
        <div className="md:col-span-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-3">
            preview
          </p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
            className="aspect-[16/9] relative"
          >
            <GlassCard
              className="absolute inset-0 p-8 overflow-hidden"
              tilt={true}
            >
              {/* Ambient glows */}
              <div
                aria-hidden
                className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl"
                style={{ background: "rgba(197, 214, 52, 0.18)" }}
              />
              <div
                aria-hidden
                className="absolute -bottom-24 -left-16 w-60 h-60 rounded-full blur-3xl"
                style={{ background: "rgba(45, 74, 62, 0.5)" }}
              />

              <div className="relative h-full flex flex-col justify-between">
                {/* Top row: avatar + name */}
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16">
                    <div
                      className="absolute -inset-1 rounded-2xl blur-md opacity-70"
                      style={{
                        background:
                          "conic-gradient(from 0deg, rgba(197,214,52,0.6), rgba(45,74,62,0.3), rgba(197,214,52,0.6))",
                      }}
                    />
                    <div className="relative w-full h-full rounded-2xl bg-[color:var(--dopl-sage)] overflow-hidden flex items-center justify-center">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-display text-2xl text-[color:var(--dopl-lime)]">
                          {(displayName || handle)[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h2 className="font-display text-2xl md:text-3xl font-semibold leading-tight tracking-tight">
                      {displayName || handle}
                    </h2>
                    <p className="text-sm text-[color:var(--dopl-cream)]/50 font-mono">
                      @{handle}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-end gap-8">
                  <div>
                    <p className="font-mono text-3xl md:text-4xl font-bold text-[color:var(--dopl-lime)] leading-none">
                      <CountUp value={subscriberCount} duration={1.2} />
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mt-2">
                      doplers
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-3xl md:text-4xl font-bold text-[color:var(--dopl-cream)]/80 leading-none">
                      <CountUp value={portfolioCount} duration={1.2} />
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mt-2">
                      portfolios
                    </p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="font-mono text-sm text-[color:var(--dopl-lime)]">
                      {url.replace(/^https?:\/\//, "")}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/30 mt-1">
                      live portfolio · real positions
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
          <p className="text-[10px] text-[color:var(--dopl-cream)]/30 mt-3 font-mono text-center">
            download renders to 1200×630 PNG
          </p>
        </div>

        {/* Actions */}
        <div className="md:col-span-2 space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-3">
            actions
          </p>
          <ActionButton onClick={copy} icon={copied ? <Check size={18} /> : <Copy size={18} />} title={copied ? "copied" : "copy link"} sub={url.replace(/^https?:\/\//, "")} />
          <ActionButton onClick={download} icon={<Download size={18} />} title="download PNG" sub="1200×630 · twitter / instagram" />
          <ActionButton onClick={shareOnX} icon={<Share2 size={18} />} title="share on X" sub="opens tweet composer" />
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  icon,
  title,
  sub,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      className="glass-card p-4 w-full flex items-center gap-3 text-left hover:translate-y-[-1px] transition-transform"
    >
      <div className="w-10 h-10 rounded-xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{title}</p>
        <p className="text-xs text-[color:var(--dopl-cream)]/40 font-mono truncate">
          {sub}
        </p>
      </div>
    </button>
  );
}
