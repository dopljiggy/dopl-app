"use client";

import { useState } from "react";
import { Share2, Download, Copy, Check } from "lucide-react";

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
        <div className="glass-card p-12 text-center max-w-lg">
          <p className="text-dopl-cream/60 mb-4">
            set your handle in profile first to get a shareable link
          </p>
          <a href="/dashboard/profile" className="btn-lime text-sm px-6 py-2.5">
            edit profile
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-2">share</h1>
      <p className="text-dopl-cream/50 text-sm mb-8">
        share your dopl page with your audience
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <p className="text-xs text-dopl-cream/40 mb-3">preview card</p>
          <div className="glass-card p-8 relative overflow-hidden aspect-[5/4]">
            <div className="absolute top-0 right-0 w-40 h-40 bg-dopl-lime/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="relative h-full flex flex-col">
              <div className="w-16 h-16 rounded-2xl bg-dopl-sage mb-4 flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-2xl text-dopl-lime">
                    {(displayName || handle)[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <h2 className="font-display text-2xl font-semibold mb-1">
                {displayName || handle}
              </h2>
              <p className="text-dopl-cream/50 text-sm mb-4">@{handle}</p>
              <div className="flex gap-6 mb-4">
                <div>
                  <p className="font-mono text-xl font-bold text-dopl-lime">
                    {subscriberCount}
                  </p>
                  <p className="text-xs text-dopl-cream/30">subscribers</p>
                </div>
                <div>
                  <p className="font-mono text-xl font-bold text-dopl-cream/70">
                    {portfolioCount}
                  </p>
                  <p className="text-xs text-dopl-cream/30">portfolios</p>
                </div>
              </div>
              <div className="border-t border-dopl-sage/20 pt-4 mt-auto">
                <p className="font-mono text-xs text-dopl-lime">{url}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-dopl-cream/40 mb-3">share options</p>

          <button
            onClick={copy}
            className="glass-card p-5 w-full flex items-center gap-4 hover:border-dopl-lime/30 transition-colors text-left"
          >
            {copied ? (
              <Check size={20} className="text-dopl-lime flex-shrink-0" />
            ) : (
              <Copy size={20} className="text-dopl-lime flex-shrink-0" />
            )}
            <div>
              <p className="text-sm font-semibold">
                {copied ? "copied" : "copy link"}
              </p>
              <p className="text-xs text-dopl-cream/40 font-mono">{url}</p>
            </div>
          </button>

          <button
            onClick={download}
            className="glass-card p-5 w-full flex items-center gap-4 hover:border-dopl-lime/30 transition-colors text-left"
          >
            <Download size={20} className="text-dopl-lime flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">download card</p>
              <p className="text-xs text-dopl-cream/40">
                save as PNG for X, Instagram, etc.
              </p>
            </div>
          </button>

          <button
            onClick={shareOnX}
            className="glass-card p-5 w-full flex items-center gap-4 hover:border-dopl-lime/30 transition-colors text-left"
          >
            <Share2 size={20} className="text-dopl-lime flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">share on X</p>
              <p className="text-xs text-dopl-cream/40">
                post your dopl card directly
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
