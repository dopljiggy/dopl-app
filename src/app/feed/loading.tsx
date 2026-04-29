/**
 * Skeleton for /feed. Mirrors `feed-sections.tsx`: each portfolio is a
 * collapsible card with an FM strip in the header and a dense position
 * table in the body.
 */
export default function FeedLoading() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 animate-pulse">
      <div className="h-8 w-32 rounded bg-[color:var(--dopl-sage)]/20" />
      <div className="mt-2 h-4 w-64 rounded bg-[color:var(--dopl-sage)]/10 mb-10" />

      <div className="space-y-6">
        {[0, 1].map((i) => (
          <div key={i} className="glass-card-light rounded-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-[color:var(--dopl-sage)]/25" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-[color:var(--dopl-sage)]/20" />
                <div className="h-3 w-20 rounded bg-[color:var(--dopl-sage)]/15" />
              </div>
              <div className="h-6 w-16 rounded bg-[color:var(--dopl-sage)]/20" />
            </div>
            <div className="border-t border-[color:var(--glass-border)]">
              {[0, 1, 2, 3, 4].map((r) => (
                <div
                  key={r}
                  className="grid grid-cols-5 gap-3 px-5 py-3 border-t border-[color:var(--glass-border)] first:border-t-0"
                >
                  <div className="h-4 rounded bg-[color:var(--dopl-sage)]/20" />
                  <div className="h-4 rounded bg-[color:var(--dopl-sage)]/15" />
                  <div className="h-4 rounded bg-[color:var(--dopl-sage)]/15" />
                  <div className="h-4 rounded bg-[color:var(--dopl-sage)]/15" />
                  <div className="h-4 rounded bg-[color:var(--dopl-sage)]/20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
