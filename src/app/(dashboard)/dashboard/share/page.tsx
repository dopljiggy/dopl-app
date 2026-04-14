"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Share2, Download, Copy, Check, Loader2 } from "lucide-react";
import { fireToast } from "@/components/ui/toast";

const PROD_ORIGIN = "https://dopl-app.vercel.app";

interface FMData {
  handle: string;
  display_name: string;
  avatar_url: string | null;
  subscriber_count: number;
  portfolioCount: number;
  portfolioNames: string[];
}

/**
 * Fund manager share page — pure client component.
 * No redirects, no profile imports. Always renders the share UI.
 */
export default function SharePage() {
  const [data, setData] = useState<FMData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !mounted) {
        setLoading(false);
        return;
      }

      // The handle is read ONLY from fund_managers.handle. No email prefix
      // fallback — if the row is missing or the handle column is empty, we
      // render a "set your handle" notice rather than invent one that
      // generates a 404 when shared.
      const { data: fm } = await supabase
        .from("fund_managers")
        .select("handle, display_name, avatar_url, subscriber_count")
        .eq("id", user.id)
        .maybeSingle();

      const { data: portfolios } = await supabase
        .from("portfolios")
        .select("name")
        .eq("fund_manager_id", user.id)
        .eq("is_active", true)
        .order("price_cents", { ascending: false });

      if (!mounted) return;

      setData({
        handle: fm?.handle ?? "",
        display_name: fm?.display_name ?? "",
        avatar_url: fm?.avatar_url ?? null,
        subscriber_count: fm?.subscriber_count ?? 0,
        portfolioCount: portfolios?.length ?? 0,
        portfolioNames: (portfolios ?? []).map((p) => p.name),
      });
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handle = data?.handle ?? "";
  const url = handle ? `${PROD_ORIGIN}/${handle}` : "";

  const copyLink = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    fireToast({ title: "copied!", body: url.replace(/^https?:\/\//, "") });
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadPng = async () => {
    const node = cardRef.current;
    if (!node || !handle || downloading) return;
    setDownloading(true);
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(node, {
        pixelRatio: 2,
        backgroundColor: "#0D261F",
        cacheBust: true,
      });
      if (!blob) throw new Error("blob failed");
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${handle}-dopl.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      fireToast({ title: "downloaded", body: `${handle}-dopl.png` });
    } catch {
      // Fallback: server-rendered share card
      const a = document.createElement("a");
      a.href = `/api/share-card/${handle}`;
      a.download = `${handle}-dopl.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setDownloading(false);
    }
  };

  const shareOnX = () => {
    if (!url) return;
    const intent =
      `https://twitter.com/intent/tweet` +
      `?text=${encodeURIComponent("follow my portfolio on dopl")}` +
      `&url=${encodeURIComponent(url)}`;
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

      {loading ? (
        <div className="glass-card p-12 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-[color:var(--dopl-lime)]" />
        </div>
      ) : !handle ? (
        <div className="glass-card p-6 max-w-lg glow-loss">
          <p className="text-sm font-semibold mb-1">set your handle first</p>
          <p className="text-xs text-[color:var(--dopl-cream)]/60 mb-4">
            your share link needs a handle registered in fund_managers.
          </p>
          <a
            href="/dashboard/profile"
            className="btn-lime text-sm px-6 py-2.5 inline-flex items-center"
          >
            edit profile
          </a>
        </div>
      ) : (
        <div className="grid md:grid-cols-5 gap-6">
          {/* Preview card — html-to-image captures this exact node */}
          <div className="md:col-span-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-3">
              preview
            </p>
            <div
              ref={cardRef}
              id="share-card"
              className="aspect-[16/9] relative rounded-[22px] overflow-hidden p-8"
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
                className="absolute -top-20 -right-20 w-60 h-60 rounded-full"
                style={{
                  background: "rgba(197, 214, 52, 0.2)",
                  filter: "blur(60px)",
                }}
              />
              <div
                aria-hidden
                className="absolute -bottom-24 -left-16 w-60 h-60 rounded-full"
                style={{
                  background: "rgba(45, 74, 62, 0.55)",
                  filter: "blur(60px)",
                }}
              />

              <div className="relative h-full flex flex-col justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
                    style={{ background: "#2D4A3E" }}>
                    {data?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.avatar_url}
                        alt=""
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span
                        className="font-display text-2xl"
                        style={{ color: "#C5D634" }}
                      >
                        {((data?.display_name || handle) || "?")[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight">
                      {data?.display_name || handle}
                    </h2>
                    <p className="text-sm text-[color:var(--dopl-cream)]/50 font-mono">
                      @{handle}
                    </p>
                  </div>
                </div>

                {data && data.portfolioNames.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {data.portfolioNames.slice(0, 3).map((n, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded"
                        style={{
                          background: "rgba(45, 74, 62, 0.5)",
                          color: "rgba(243, 239, 232, 0.8)",
                        }}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-8">
                  <div>
                    <p
                      className="font-mono text-4xl font-bold leading-none"
                      style={{ color: "#C5D634" }}
                    >
                      {data?.subscriber_count ?? 0}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mt-2">
                      doplers
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-4xl font-bold text-[color:var(--dopl-cream)]/80 leading-none">
                      {data?.portfolioCount ?? 0}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mt-2">
                      portfolios
                    </p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="font-mono text-sm" style={{ color: "#C5D634" }}>
                      dopl-app.vercel.app/{handle}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/30 mt-1">
                      powered by dopl
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-[color:var(--dopl-cream)]/30 mt-3 font-mono text-center">
              exports as 2x-quality PNG
            </p>
          </div>

          {/* Action buttons */}
          <div className="md:col-span-2 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-3">
              actions
            </p>
            <button
              onClick={copyLink}
              className="glass-card p-4 w-full flex items-center gap-3 text-left hover:translate-y-[-1px] transition-transform"
            >
              <div className="w-10 h-10 rounded-xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] flex-shrink-0">
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {copied ? "copied!" : "copy link"}
                </p>
                <p className="text-xs text-[color:var(--dopl-cream)]/40 font-mono truncate">
                  dopl-app.vercel.app/{handle}
                </p>
              </div>
            </button>

            <button
              onClick={downloadPng}
              disabled={downloading}
              className="glass-card p-4 w-full flex items-center gap-3 text-left hover:translate-y-[-1px] transition-transform disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] flex-shrink-0">
                {downloading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Download size={18} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {downloading ? "rendering..." : "download PNG"}
                </p>
                <p className="text-xs text-[color:var(--dopl-cream)]/40 font-mono">
                  save card as image
                </p>
              </div>
            </button>

            <button
              onClick={shareOnX}
              className="glass-card p-4 w-full flex items-center gap-3 text-left hover:translate-y-[-1px] transition-transform"
            >
              <div className="w-10 h-10 rounded-xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] flex-shrink-0">
                <Share2 size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">share on X</p>
                <p className="text-xs text-[color:var(--dopl-cream)]/40 font-mono">
                  opens tweet composer
                </p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
