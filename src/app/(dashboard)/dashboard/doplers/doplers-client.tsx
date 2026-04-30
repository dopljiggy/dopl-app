"use client";

import { useMemo, useState } from "react";
import { Download, Users } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import CountUp from "@/components/ui/count-up";
import { downloadCsv } from "@/lib/csv";
import { timeAgo } from "@/lib/time-ago";

export type DoplerRow = {
  id: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  portfolioName: string;
  tier: string;
  status: string;
  priceCents: number | null;
  createdAt: string;
  cancelledAt: string | null;
};

type Stats = {
  totalDoplers: number;
  activeDoplers: number;
  monthlyRevenueCents: number;
  churn30d: number;
};

type SortKey = "joined" | "dopler" | "portfolio" | "price" | "status";

export default function DoplersClient({
  rows,
  stats,
}: {
  rows: DoplerRow[];
  stats: Stats;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("joined");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "joined":
          return (
            (new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()) *
            dir
          );
        case "dopler":
          return (
            (a.fullName ?? a.email ?? "").localeCompare(
              b.fullName ?? b.email ?? ""
            ) * dir
          );
        case "portfolio":
          return a.portfolioName.localeCompare(b.portfolioName) * dir;
        case "price":
          return ((a.priceCents ?? 0) - (b.priceCents ?? 0)) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
      }
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "joined" ? "desc" : "asc");
    }
  };

  const exportCsv = () => {
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `dopl-doplers-${today}.csv`,
      [
        "name",
        "email",
        "portfolio",
        "tier",
        "status",
        "price_monthly_cents",
        "joined_at",
        "cancelled_at",
      ],
      sorted.map((r) => [
        r.fullName,
        r.email,
        r.portfolioName,
        r.tier,
        r.status,
        r.priceCents,
        r.createdAt,
        r.cancelledAt,
      ])
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h1 className="font-display text-3xl font-semibold">doplers</h1>
        <button
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="glass-card-light px-4 py-2 text-sm flex items-center gap-2 hover:bg-dopl-sage/40 transition-colors disabled:opacity-40"
        >
          <Download size={14} />
          export CSV
        </button>
      </div>
      <p className="text-dopl-cream/50 text-sm mb-8">
        every dopler currently or previously subscribed to your portfolios.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="total doplers" value={stats.totalDoplers} />
        <StatCard label="active" value={stats.activeDoplers} />
        <StatCard
          label="revenue/mo"
          value={stats.monthlyRevenueCents / 100}
          prefix="$"
        />
        <StatCard label="churn (30d)" value={stats.churn30d} />
      </div>

      {rows.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Users
            size={28}
            className="text-[color:var(--dopl-cream)]/20 mx-auto mb-3"
          />
          <p className="text-sm text-dopl-cream/50 mb-1">no doplers yet</p>
          <p className="text-xs text-dopl-cream/30">
            share your profile to start picking up subscribers.
          </p>
        </GlassCard>
      ) : (
        <div className="glass-card-light rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--dopl-cream)]/40 border-b border-[color:var(--glass-border)]">
                  <SortHeader
                    label="dopler"
                    active={sortKey === "dopler"}
                    dir={sortDir}
                    onClick={() => toggleSort("dopler")}
                    align="left"
                  />
                  <SortHeader
                    label="portfolio"
                    active={sortKey === "portfolio"}
                    dir={sortDir}
                    onClick={() => toggleSort("portfolio")}
                    align="left"
                  />
                  <SortHeader
                    label="tier"
                    active={false}
                    dir={sortDir}
                    onClick={() => undefined}
                    align="left"
                    sortable={false}
                  />
                  <SortHeader
                    label="status"
                    active={sortKey === "status"}
                    dir={sortDir}
                    onClick={() => toggleSort("status")}
                    align="left"
                  />
                  <SortHeader
                    label="price"
                    active={sortKey === "price"}
                    dir={sortDir}
                    onClick={() => toggleSort("price")}
                    align="right"
                  />
                  <SortHeader
                    label="joined"
                    active={sortKey === "joined"}
                    dir={sortDir}
                    onClick={() => toggleSort("joined")}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[color:var(--glass-border)] last:border-0 hover:bg-[color:var(--dopl-sage)]/10 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[color:var(--dopl-cream)]">
                        {r.fullName ?? r.email ?? "—"}
                      </p>
                      {r.fullName && r.email && (
                        <p className="text-[11px] text-[color:var(--dopl-cream)]/40 font-mono">
                          {r.email}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[color:var(--dopl-cream)]/80">
                      {r.portfolioName}
                    </td>
                    <td className="px-4 py-3">
                      <TierBadge tier={r.tier} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {r.priceCents == null
                        ? "—"
                        : r.priceCents === 0
                          ? "free"
                          : `$${(r.priceCents / 100).toFixed(0)}/mo`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[color:var(--dopl-cream)]/60 text-[11px]">
                      {timeAgo(r.createdAt)} ago
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  prefix = "",
}: {
  label: string;
  value: number;
  prefix?: string;
}) {
  return (
    <GlassCard className="p-5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-2">
        {label}
      </p>
      <p className="font-mono text-3xl font-bold text-[color:var(--dopl-lime)] leading-none">
        <CountUp value={value} prefix={prefix} decimals={0} duration={1.0} />
      </p>
    </GlassCard>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const palette =
    tier === "free"
      ? "bg-[color:var(--dopl-lime)]/15 text-[color:var(--dopl-lime)]"
      : tier === "vip"
        ? "bg-[color:var(--dopl-lime)]/20 text-[color:var(--dopl-lime)]"
        : "bg-[color:var(--dopl-sage)]/40 text-[color:var(--dopl-cream)]/80";
  return (
    <span
      className={`text-[10px] font-mono font-semibold px-2 py-1 rounded uppercase tracking-wider ${palette}`}
    >
      {tier}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span
      className={`text-[10px] font-mono font-semibold px-2 py-1 rounded uppercase tracking-wider ${
        isActive
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-[color:var(--dopl-sage)]/40 text-[color:var(--dopl-cream)]/60"
      }`}
    >
      {status}
    </span>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
  sortable = true,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
  sortable?: boolean;
}) {
  return (
    <th
      onClick={sortable ? onClick : undefined}
      className={`px-4 py-2.5 font-normal ${
        align === "right" ? "text-right" : "text-left"
      } ${sortable ? "cursor-pointer hover:text-[color:var(--dopl-cream)]" : ""}`}
    >
      <span>
        {label}
        {active && sortable ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </span>
    </th>
  );
}
