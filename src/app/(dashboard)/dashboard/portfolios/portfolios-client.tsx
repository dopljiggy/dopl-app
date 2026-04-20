"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Briefcase, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Portfolio } from "@/types/database";
import { GlassCard } from "@/components/ui/glass-card";
import ExpandablePortfolioCard, {
  type PositionRow,
} from "./expandable-portfolio-card";

interface NewPortfolio {
  name: string;
  description: string;
  tier: "free" | "basic" | "premium" | "vip";
  price: string;
}

const tiers = [
  { value: "free", label: "free", desc: "visible to everyone" },
  { value: "basic", label: "basic", desc: "entry level" },
  { value: "premium", label: "premium", desc: "advanced" },
  { value: "vip", label: "vip", desc: "full access" },
] as const;

export default function PortfoliosClient({
  portfolios,
  positions,
  brokerProvider,
  stripeOnboarded,
}: {
  portfolios: Portfolio[];
  positions: PositionRow[];
  brokerProvider?: string | null;
  stripeOnboarded: boolean;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newPortfolio, setNewPortfolio] = useState<NewPortfolio>({
    name: "",
    description: "",
    tier: "basic",
    price: "29",
  });

  const positionsByPortfolio = new Map<string, PositionRow[]>();
  for (const p of positions) {
    const list = positionsByPortfolio.get(p.portfolio_id) ?? [];
    list.push(p);
    positionsByPortfolio.set(p.portfolio_id, list);
  }

  const handleCreate = async () => {
    setSubmitting(true);
    const res = await fetch("/api/portfolios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newPortfolio.name,
        description: newPortfolio.description,
        tier: newPortfolio.tier,
        price_cents:
          newPortfolio.tier === "free"
            ? 0
            : Math.round(parseFloat(newPortfolio.price || "0") * 100),
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setShowCreate(false);
      setNewPortfolio({ name: "", description: "", tier: "basic", price: "29" });
      router.refresh();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("delete this portfolio?")) return;
    await fetch(`/api/portfolios/${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
          portfolios
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-lime text-sm px-5 py-2.5 flex items-center gap-2"
        >
          <Plus size={16} />
          new portfolio
        </button>
      </div>

      {portfolios.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Briefcase
            size={40}
            className="text-[color:var(--dopl-cream)]/20 mx-auto mb-4"
          />
          <h2 className="font-display text-lg font-semibold mb-2">
            no portfolios yet
          </h2>
          <p className="text-[color:var(--dopl-cream)]/40 text-sm mb-6">
            create your first portfolio and assign positions from your broker
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-lime text-sm px-6 py-2.5"
          >
            create your first portfolio
          </button>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {portfolios.map((p) => (
            <div key={p.id}>
              {p.tier !== "free" && !stripeOnboarded && (
                <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300/70 font-mono mb-1 flex items-center gap-1.5">
                  <Lock size={10} />
                  set up stripe to publish
                </div>
              )}
              <ExpandablePortfolioCard
                portfolio={p}
                positions={positionsByPortfolio.get(p.id) ?? []}
                isExpanded={expandedId === p.id}
                onToggle={() =>
                  setExpandedId(expandedId === p.id ? null : p.id)
                }
                onDelete={() => handleDelete(p.id)}
                brokerProvider={brokerProvider}
              />
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card p-8 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-display text-xl font-semibold mb-6">
                create portfolio
              </h2>

              <input
                type="text"
                placeholder="portfolio name (e.g. Growth Portfolio)"
                value={newPortfolio.name}
                onChange={(e) =>
                  setNewPortfolio({ ...newPortfolio, name: e.target.value })
                }
                className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-4 py-3 text-sm placeholder:text-[color:var(--dopl-cream)]/30 mb-3"
              />
              <textarea
                placeholder="description (optional)"
                value={newPortfolio.description}
                onChange={(e) =>
                  setNewPortfolio({
                    ...newPortfolio,
                    description: e.target.value,
                  })
                }
                rows={3}
                className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-4 py-3 text-sm placeholder:text-[color:var(--dopl-cream)]/30 mb-4 resize-none"
              />

              <p className="text-xs text-[color:var(--dopl-cream)]/40 mb-2">
                tier
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {tiers.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() =>
                      setNewPortfolio({ ...newPortfolio, tier: t.value })
                    }
                    className={`p-3 rounded-lg text-left transition-all ${
                      newPortfolio.tier === t.value
                        ? "bg-[color:var(--dopl-lime)]/10 border border-[color:var(--dopl-lime)]/30"
                        : "glass-card-light hover:bg-[color:var(--dopl-sage)]/30"
                    }`}
                  >
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="text-xs text-[color:var(--dopl-cream)]/40">
                      {t.desc}
                    </p>
                  </button>
                ))}
              </div>

              {newPortfolio.tier !== "free" && (
                <div className="relative mb-6">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--dopl-cream)]/30 text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    value={newPortfolio.price}
                    onChange={(e) =>
                      setNewPortfolio({
                        ...newPortfolio,
                        price: e.target.value,
                      })
                    }
                    className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg pl-8 pr-16 py-3 text-sm"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--dopl-cream)]/30 text-sm">
                    /month
                  </span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 glass-card-light py-3 text-sm hover:bg-[color:var(--dopl-sage)]/40 rounded-xl transition-colors"
                >
                  cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={submitting || !newPortfolio.name}
                  className="flex-1 btn-lime text-sm py-3 disabled:opacity-50"
                >
                  {submitting ? "creating..." : "create"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
