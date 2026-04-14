"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Share2, Download, Copy, Check, AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import CountUp from "@/components/ui/count-up";
import { fireToast } from "@/components/ui/toast";

const PROD_ORIGIN = "https://dopl-app.vercel.app";

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
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const origin =
    typeof window !== "undefined" ? window.location.origin : PROD_ORIGIN;
  const url = handle ? `${origin}/${handle}` : "";
  const shareUrl = handle ? `${PROD_ORIGIN}/${handle}` : "";

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    fireToast({
      title: "copied!",
      body: url.replace(/^https?:\/\//, ""),
    });
    setTimeout(() => setCopied(false), 1500);
  };

  const download = async () => {
    if (!handle || !cardRef.current || downloading) return;
    setDownloading(true);
    try {
      // Try client-side html-to-image first (preserves exact styling).
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: "#0D261F",
        cacheBust: true,
      });
      triggerDownload(dataUrl, `${handle}-dopl.png`);
    } catch {
      // Fallback: server-rendered OG image at /api/share-card/[handle].
      triggerDownload(`/api/share-card/${handle}`, `${handle}-dopl.png`);
    } finally {
      setDownloading(false);
    }
  };

  const shareOnX = () => {
    if (!shareUrl) return;
    const intent =
      `https://twitter.com/intent/tweet` +
      `?text=${encodeURIComponent("follow my portfolio on dopl")}` +
      `&url=${encodeURIComponent(shareUrl)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-2">
        share
      </h1>
      <p className="text-[color:var(--dopl-cream)]/50 text-sm mb-8">
        download a premium card and drop it anywhere
      </p>

      {!handle && (
        <GlassCard className="p-4 mb-6 flex items-start gap-3" glow="loss">
          <AlertTriangle
            size={18}
            className="text-red-300 flex-shrink-0 mt-0.5"
          />
          <div className="text-sm">
            <p className="font-semibold mb-1">set your handle</p>
            <p className="text-xs text-[color:var(--dopl-cream)]/60">
              your shareable link needs a handle.{" "}
              <a
                href="/dashboard/profile"
                className="text-[color:var(--dopl-lime)] underline hover:no-underline"
              >
                edit profile
              </a>
              .
            </p>
          </div>
        </GlassCard>
      )}

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
            ref={cardRef}
          >
            <div
              className="absolute inset-0 rounded-[22px] overflow-hidden p-8"
              style={{
                background:
                  "linear-gradient(135deg, #0A1F18 0%, #0D261F 55%, #112A22 100%)",
                border: "1px solid rgba(197, 214, 52, 0.22)",
                boxShadow:
                  "inset 0 1px 0 rgba(243,239,232,0.08), 0 30px 60px -20px rgba(0,0,0,0.6)",
              }}
            >
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
                          crossOrigin="anonymous"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-display text-2xl text-[color:var(--dopl-lime)]">
                          {((displayName || handle) || "?")[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h2 className="font-display text-2xl md:text-3xl font-semibold leading-tight tracking-tight">
                      {displayName || handle || "set your name"}
                    </h2>
                    <p className="text-sm text-[color:var(--dopl-cream)]/50 font-mono">
                      @{handle || "handle"}
                    </p>
                  </div>
                </div>

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
                      {(url || `${PROD_ORIGIN}/${handle}`).replace(
                        /^https?:\/\//,
                        ""
                      )}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/30 mt-1">
                      powered by dopl
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          <p className="text-[10px] text-[color:var(--dopl-cream)]/30 mt-3 font-mono text-center">
            exports as 2x-quality PNG from the live preview
          </p>
        </div>

        {/* Actions */}
        <div className="md:col-span-2 space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-3">
            actions
          </p>
          <ActionButton
            onClick={copy}
            icon={copied ? <Check size={18} /> : <Copy size={18} />}
            title={copied ? "copied" : "copy link"}
            sub={url ? url.replace(/^https?:\/\//, "") : "set handle first"}
            disabled={!handle}
          />
          <ActionButton
            onClick={download}
            icon={<Download size={18} />}
            title={downloading ? "rendering..." : "download card"}
            sub="save as PNG"
            disabled={!handle || downloading}
          />
          <ActionButton
            onClick={shareOnX}
            icon={<Share2 size={18} />}
            title="share on X"
            sub="opens tweet composer"
            disabled={!handle}
          />
        </div>
      </div>
    </div>
  );
}

function triggerDownload(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function ActionButton({
  onClick,
  icon,
  title,
  sub,
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="glass-card p-4 w-full flex items-center gap-3 text-left hover:translate-y-[-1px] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
