"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Briefcase, Users, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Portfolio } from "@/types/database";

type PortfolioWithCount = Portfolio & { position_count: number };

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
}: {
  portfolios: PortfolioWithCount[];
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newPortfolio, setNewPortfolio] = useState<NewPortfolio>({
    name: "",
    description: "",
    tier: "basic",
    price: "29",
  });

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
        <h1 className="font-display text-3xl font-semibold">portfolios</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-lime text-sm px-5 py-2.5 flex items-center gap-2"
        >
          <Plus size={16} />
          new portfolio
        </button>
      </div>

      {portfolios.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Briefcase size={40} className="text-dopl-cream/20 mx-auto mb-4" />
          <h2 className="font-display text-lg font-semibold mb-2">
            no portfolios yet
          </h2>
          <p className="text-dopl-cream/40 text-sm mb-6">
            create your first portfolio and assign positions from your broker
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-lime text-sm px-6 py-2.5"
          >
            create your first portfolio
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolios.map((p) => (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }}
              className="glass-card p-6 flex flex-col relative"
            >
              <div className="flex items-center justify-between mb-3 relative z-10 pointer-events-none">
                <span
                  className={`text-xs font-mono font-semibold px-2 py-1 rounded ${
                    p.tier === "free"
                      ? "bg-dopl-sage/50 text-dopl-cream/70"
                      : p.tier === "vip"
                      ? "bg-dopl-lime/20 text-dopl-lime"
                      : "bg-dopl-sage/30 text-dopl-cream/70"
                  }`}
                >
                  {p.tier}
                </span>
                <span className="font-mono text-lg font-bold text-dopl-lime">
                  {p.price_cents === 0
                    ? "free"
                    : `$${(p.price_cents / 100).toFixed(0)}/mo`}
                </span>
              </div>
              <h3 className="font-display text-lg font-semibold mb-1">
                {p.name}
              </h3>
              {p.description && (
                <p className="text-dopl-cream/50 text-sm mb-4 line-clamp-2">
                  {p.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-xs text-dopl-cream/40 mt-auto pt-4 border-t border-dopl-sage/20 relative z-10">
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  <span className="font-mono">{p.subscriber_count}</span> subs
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase size={12} />
                  <span className="font-mono">{p.position_count}</span> positions
                </span>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="ml-auto text-dopl-cream/30 hover:text-red-400 transition-colors"
                  aria-label="delete portfolio"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <Link
                href={`/dashboard/portfolios/${p.id}`}
                className="absolute inset-0 rounded-2xl z-0"
                aria-label={`open ${p.name}`}
              />
            </motion.div>
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
                className="w-full bg-dopl-deep border border-dopl-sage/30 rounded-lg px-4 py-3 text-sm text-dopl-cream placeholder:text-dopl-cream/30 focus:outline-none focus:border-dopl-lime/50 mb-3"
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
                className="w-full bg-dopl-deep border border-dopl-sage/30 rounded-lg px-4 py-3 text-sm text-dopl-cream placeholder:text-dopl-cream/30 focus:outline-none focus:border-dopl-lime/50 mb-4 resize-none"
              />

              <p className="text-xs text-dopl-cream/40 mb-2">tier</p>
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
                        ? "bg-dopl-lime/10 border border-dopl-lime/30"
                        : "glass-card-light hover:bg-dopl-sage/30"
                    }`}
                  >
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="text-xs text-dopl-cream/40">{t.desc}</p>
                  </button>
                ))}
              </div>

              {newPortfolio.tier !== "free" && (
                <div className="relative mb-6">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dopl-cream/30 text-sm">
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
                    className="w-full bg-dopl-deep border border-dopl-sage/30 rounded-lg pl-8 pr-16 py-3 text-sm text-dopl-cream focus:outline-none focus:border-dopl-lime/50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dopl-cream/30 text-sm">
                    /month
                  </span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 glass-card-light py-3 text-sm hover:bg-dopl-sage/40 transition-colors"
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
