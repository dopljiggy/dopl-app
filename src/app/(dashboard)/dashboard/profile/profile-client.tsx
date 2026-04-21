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

export default function ProfileClient({ initial }: { initial: ProfileForm }) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileForm>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const platforms = ["x", "youtube", "instagram", "discord", "website"];

  const addLink = () =>
    setProfile({
      ...profile,
      links: [...profile.links, { platform: "x", url: "" }],
    });

  const removeLink = (i: number) =>
    setProfile({
      ...profile,
      links: profile.links.filter((_, idx) => idx !== i),
    });

  const updateLink = (index: number, field: string, value: string) => {
    const updated = [...profile.links];
    updated[index] = { ...updated[index], [field]: value };
    setProfile({ ...profile, links: updated });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: profile.display_name,
        handle: profile.handle,
        bio: profile.bio,
        links: profile.links.filter((l) => l.url.trim()),
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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-semibold">edit profile</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-lime text-sm px-5 py-2.5 flex items-center gap-2 disabled:opacity-50"
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saving ? "saving..." : saved ? "saved" : "save changes"}
        </button>
      </div>

      {error && (
        <div className="max-w-xl mb-4 glass-card-light p-3 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="max-w-xl space-y-6">
        <div className="glass-card p-6">
          <label className="text-xs text-dopl-cream/40 mb-2 block">
            display name
          </label>
          <input
            type="text"
            value={profile.display_name}
            onChange={(e) =>
              setProfile({ ...profile, display_name: e.target.value })
            }
            placeholder="your name"
            className="w-full bg-dopl-deep border border-dopl-sage/30 rounded-lg px-4 py-3 text-sm text-dopl-cream placeholder:text-dopl-cream/30 focus:outline-none focus:border-dopl-lime/50"
          />
        </div>

        <div className="glass-card p-6">
          <label className="text-xs text-dopl-cream/40 mb-2 block">handle</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dopl-cream/30 text-sm">
              dopl.com/
            </span>
            <input
              type="text"
              value={profile.handle}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  handle: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-_]/g, ""),
                })
              }
              className="w-full bg-dopl-deep border border-dopl-sage/30 rounded-lg pl-[5.5rem] pr-4 py-3 text-sm text-dopl-cream focus:outline-none focus:border-dopl-lime/50"
            />
          </div>
        </div>

        <div className="glass-card p-6">
          <label className="text-xs text-dopl-cream/40 mb-2 block">
            bio <span className="text-dopl-cream/20">(280 chars)</span>
          </label>
          <textarea
            value={profile.bio}
            onChange={(e) =>
              setProfile({ ...profile, bio: e.target.value.slice(0, 280) })
            }
            rows={3}
            placeholder="tell followers what you trade and why they should follow your portfolio"
            className="w-full bg-dopl-deep border border-dopl-sage/30 rounded-lg px-4 py-3 text-sm text-dopl-cream placeholder:text-dopl-cream/30 focus:outline-none focus:border-dopl-lime/50 resize-none"
          />
          <p className="text-xs text-dopl-cream/20 text-right mt-1">
            {profile.bio.length}/280
          </p>
        </div>

        <div className="glass-card p-6">
          <label className="text-xs text-dopl-cream/40 mb-4 block">links</label>
          {profile.links.map((link, i) => (
            <div key={i} className="flex gap-2 mb-3">
              <select
                value={link.platform}
                onChange={(e) => updateLink(i, "platform", e.target.value)}
                className="bg-dopl-deep border border-dopl-sage/30 rounded-lg px-3 py-3 text-sm text-dopl-cream focus:outline-none focus:border-dopl-lime/50"
              >
                {platforms.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                type="url"
                value={link.url}
                onChange={(e) => updateLink(i, "url", e.target.value)}
                placeholder="https://"
                className="flex-1 bg-dopl-deep border border-dopl-sage/30 rounded-lg px-4 py-3 text-sm text-dopl-cream placeholder:text-dopl-cream/30 focus:outline-none focus:border-dopl-lime/50"
              />
              <button
                onClick={() => removeLink(i)}
                className="text-dopl-cream/30 hover:text-red-400 px-2 text-xs"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={addLink}
            className="text-xs text-dopl-lime hover:underline mt-2"
          >
            + add link
          </button>
        </div>

        <div className="mt-10 pt-6 border-t border-[color:var(--glass-border)]">
          <SignOutLink />
        </div>
      </div>
    </div>
  );
}
