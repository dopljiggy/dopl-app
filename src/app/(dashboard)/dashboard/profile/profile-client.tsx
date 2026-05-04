"use client";

import { useState } from "react";
import { Save, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import SignOutLink from "@/components/sign-out-link";

interface ProfileForm {
  display_name: string;
  handle: string;
  bio: string;
  links: { platform: string; url: string }[];
}

// Fixed platform rows replace the previous dynamic add-link list.
// FMs enter just the @handle (or URL for Website) — we construct the
// canonical URL on save, parse the URL back into a handle on load.
const PLATFORMS: {
  key: string;
  label: string;
  prefix: string;
  toUrl: (handle: string) => string;
  fromUrl: (url: string) => string;
}[] = [
  {
    key: "x",
    label: "X",
    prefix: "@",
    toUrl: (h) => `https://x.com/${h.replace(/^@/, "")}`,
    fromUrl: (u) => u.replace(/^https?:\/\/(?:www\.)?(?:twitter|x)\.com\//i, ""),
  },
  {
    key: "instagram",
    label: "Instagram",
    prefix: "@",
    toUrl: (h) => `https://instagram.com/${h.replace(/^@/, "")}`,
    fromUrl: (u) => u.replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, ""),
  },
  {
    key: "youtube",
    label: "YouTube",
    prefix: "@",
    toUrl: (h) => `https://youtube.com/@${h.replace(/^@/, "")}`,
    fromUrl: (u) =>
      u.replace(/^https?:\/\/(?:www\.)?youtube\.com\/@?/i, ""),
  },
  {
    key: "discord",
    label: "Discord",
    prefix: "discord.gg/",
    toUrl: (h) => `https://discord.gg/${h.replace(/^discord\.gg\//, "")}`,
    fromUrl: (u) => u.replace(/^https?:\/\/(?:www\.)?discord\.gg\//i, ""),
  },
  {
    key: "website",
    label: "Website",
    prefix: "",
    toUrl: (h) => (h.match(/^https?:\/\//i) ? h : `https://${h}`),
    fromUrl: (u) => u,
  },
];

export default function ProfileClient({ initial }: { initial: ProfileForm }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.display_name);
  const [handle, setHandle] = useState(initial.handle);
  const [bio, setBio] = useState(initial.bio);
  // Map platform key → user-entered handle (or URL for Website).
  const [linkValues, setLinkValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const p of PLATFORMS) {
      const found = initial.links.find((l) => l.platform === p.key);
      out[p.key] = found ? p.fromUrl(found.url) : "";
    }
    return out;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const links = PLATFORMS.flatMap((p) => {
      const raw = (linkValues[p.key] ?? "").trim();
      if (!raw) return [];
      return [{ platform: p.key, url: p.toUrl(raw) }];
    });
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        handle,
        bio,
        links,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "save failed");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    router.refresh();
  };

  const formCardStyle: React.CSSProperties = {
    background:
      "linear-gradient(rgba(13,38,31,0.55), rgba(13,38,31,0.55)) padding-box, linear-gradient(135deg, rgba(197,214,52,0.28), rgba(45,74,62,0.4)) border-box",
    border: "1px solid transparent",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-semibold">Edit Profile</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-lime text-sm px-5 py-2.5 flex items-center gap-2 disabled:opacity-50"
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saving ? "Saving..." : saved ? "Saved" : "Save Changes"}
        </button>
      </div>

      {error && (
        <div className="max-w-xl mb-4 glass-card-light p-3 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="max-w-xl space-y-6">
        <div className="rounded-2xl p-6" style={formCardStyle}>
          <label className="text-xs text-dopl-cream/55 mb-2 block">
            display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="your name"
            className="w-full bg-dopl-deep border border-dopl-sage/30 rounded-lg px-4 py-3 text-sm text-dopl-cream placeholder:text-dopl-cream/30 focus:outline-none focus:border-dopl-lime/50"
          />
        </div>

        <div className="rounded-2xl p-6" style={formCardStyle}>
          <label className="text-xs text-dopl-cream/55 mb-2 block">handle</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dopl-cream/45 text-sm">
              dopl.com/
            </span>
            <input
              type="text"
              value={handle}
              onChange={(e) =>
                setHandle(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "")
                )
              }
              className="w-full bg-dopl-deep border border-dopl-sage/30 rounded-lg pl-[5.5rem] pr-4 py-3 text-sm text-dopl-cream focus:outline-none focus:border-dopl-lime/50"
            />
          </div>
        </div>

        <div className="rounded-2xl p-6" style={formCardStyle}>
          <label className="text-xs text-dopl-cream/55 mb-2 block">
            bio <span className="text-dopl-cream/30">(280 chars)</span>
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 280))}
            rows={3}
            placeholder="tell followers what you trade and why they should follow your portfolio"
            className="w-full bg-dopl-deep border border-dopl-sage/30 rounded-lg px-4 py-3 text-sm text-dopl-cream placeholder:text-dopl-cream/30 focus:outline-none focus:border-dopl-lime/50 resize-none"
          />
          <p className="text-xs text-dopl-cream/30 text-right mt-1">
            {bio.length}/280
          </p>
        </div>

        <div className="rounded-2xl p-6 space-y-3" style={formCardStyle}>
          <label className="text-xs text-dopl-cream/55 mb-1 block">
            links
          </label>
          {PLATFORMS.map((p) => (
            <div
              key={p.key}
              className="flex items-center gap-2 bg-dopl-deep border border-dopl-sage/30 rounded-lg pl-3 pr-3 focus-within:border-dopl-lime/50 transition-colors"
            >
              <span className="text-xs font-mono text-dopl-cream/55 w-20 shrink-0">
                {p.label}
              </span>
              {p.prefix && (
                <span className="text-xs text-dopl-cream/35 font-mono">
                  {p.prefix}
                </span>
              )}
              <input
                type="text"
                value={linkValues[p.key] ?? ""}
                onChange={(e) =>
                  setLinkValues((prev) => ({
                    ...prev,
                    [p.key]: e.target.value,
                  }))
                }
                placeholder={p.key === "website" ? "yourdomain.com" : "handle"}
                className="flex-1 bg-transparent py-3 text-sm text-dopl-cream placeholder:text-dopl-cream/25 focus:outline-none"
              />
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-[color:var(--glass-border)]">
          <SignOutLink />
        </div>
      </div>
    </div>
  );
}
