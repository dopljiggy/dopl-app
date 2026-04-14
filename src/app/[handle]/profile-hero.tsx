"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import CountUp from "@/components/ui/count-up";
import Link from "next/link";

interface Props {
  bannerUrl: string | null;
  avatarUrl: string | null;
  displayName: string;
  handle: string;
  bio: string | null;
  subscriberCount: number;
  links: { platform: string; url: string }[];
}

const platformEmoji: Record<string, string> = {
  x: "𝕏",
  twitter: "𝕏",
  youtube: "▶",
  instagram: "◉",
  discord: "◈",
  website: "◎",
};

export default function ProfileHero({
  bannerUrl,
  avatarUrl,
  displayName,
  handle,
  bio,
  subscriberCount,
  links,
}: Props) {
  const { scrollY } = useScroll();
  const bannerY = useTransform(scrollY, [0, 400], [0, 120]);
  const bannerScale = useTransform(scrollY, [0, 400], [1, 1.12]);
  const headerOpacity = useTransform(scrollY, [0, 300], [1, 0.2]);

  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("dopl.com");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.host);
  }, []);

  const copyLink = async () => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/${handle}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <section className="relative">
      {/* Parallax banner */}
      <motion.div
        style={{ y: bannerY, scale: bannerScale }}
        className="h-56 md:h-80 w-full absolute inset-x-0 top-0 overflow-hidden"
      >
        <div
          className="w-full h-full"
          style={
            bannerUrl
              ? {
                  backgroundImage: `url(${bannerUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {
                  background:
                    "radial-gradient(80% 120% at 20% 0%, rgba(197,214,52,0.28), transparent 60%), radial-gradient(80% 120% at 100% 50%, rgba(45,74,62,0.9), transparent 60%), #0D261F",
                }
          }
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[color:var(--dopl-deep)]/50 to-[color:var(--dopl-deep)]" />
      </motion.div>

      {/* Top nav */}
      <motion.nav
        style={{ opacity: headerOpacity }}
        className="relative z-10 flex items-center justify-between px-6 py-5 max-w-5xl mx-auto"
      >
        <Link href="/" className="font-display text-xl font-semibold">
          dopl
        </Link>
        <button
          onClick={copyLink}
          className="glass-card-light px-4 py-2 text-xs font-mono transition-colors hover:bg-[color:var(--dopl-sage)]/40"
        >
          {copied ? "copied ✓" : `${origin}/${handle}`}
        </button>
      </motion.nav>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-28 md:pt-36 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
          className="flex flex-col md:flex-row md:items-end gap-6"
        >
          {/* Avatar with glow ring */}
          <div className="relative w-28 h-28 md:w-32 md:h-32 flex-shrink-0">
            <div
              className="absolute -inset-1.5 rounded-3xl blur-md opacity-80"
              style={{
                background:
                  "conic-gradient(from 0deg, rgba(197,214,52,0.6), rgba(45,74,62,0.3), rgba(197,214,52,0.6))",
              }}
            />
            <div className="relative w-full h-full rounded-3xl overflow-hidden bg-[color:var(--dopl-sage)] border border-[color:var(--dopl-lime)]/20">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-display text-4xl text-[color:var(--dopl-lime)]">
                  {displayName[0]?.toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Name + bio */}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-4xl md:text-5xl font-semibold leading-tight tracking-tight">
              {displayName}
            </h1>
            <p className="text-sm text-[color:var(--dopl-cream)]/50 font-mono mt-1">
              @{handle}
            </p>
            {bio && (
              <p className="text-[color:var(--dopl-cream)]/75 text-sm md:text-base mt-4 max-w-xl leading-relaxed">
                {bio}
              </p>
            )}
            {links.length > 0 && (
              <div className="flex items-center gap-2 mt-4">
                {links.map((l, i) => (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-card-light w-9 h-9 rounded-full flex items-center justify-center text-sm hover:text-[color:var(--dopl-lime)] transition-colors"
                    aria-label={l.platform}
                    style={{ transition: "box-shadow 200ms ease, color 200ms ease" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow =
                        "0 0 0 1px rgba(197,214,52,0.35), 0 0 24px -4px rgba(197,214,52,0.5)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "";
                    }}
                  >
                    <span>{platformEmoji[l.platform] ?? "◎"}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Subscribers stat */}
          <div className="glass-card p-5 md:min-w-[180px] text-center md:text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-1">
              subscribers
            </p>
            <p className="font-mono text-4xl font-bold text-[color:var(--dopl-lime)] leading-none">
              <CountUp value={subscriberCount} duration={1.4} />
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
