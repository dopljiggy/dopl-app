/**
 * Renders while the /dashboard server component is awaiting its data.
 * Mirrors the page's "title + 3 stat cards + checklist" layout so the
 * shimmer reads as the page filling in, not as a separate loading state.
 */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8">
        <div className="h-8 w-48 rounded bg-[color:var(--dopl-sage)]/20" />
        <div className="mt-2 h-4 w-32 rounded bg-[color:var(--dopl-sage)]/10" />
      </div>

      <div className="glass-card-light rounded-2xl p-5 mb-8 space-y-3">
        <div className="h-4 w-40 rounded bg-[color:var(--dopl-sage)]/20" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-12 rounded-lg bg-[color:var(--dopl-sage)]/15"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="glass-card-light rounded-2xl p-6 h-32 space-y-3"
          >
            <div className="h-3 w-16 rounded bg-[color:var(--dopl-sage)]/20" />
            <div className="h-8 w-24 rounded bg-[color:var(--dopl-sage)]/25" />
            <div className="h-3 w-32 rounded bg-[color:var(--dopl-sage)]/15" />
          </div>
        ))}
      </div>
    </div>
  );
}
