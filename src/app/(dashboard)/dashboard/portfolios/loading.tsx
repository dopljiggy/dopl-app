export default function PortfoliosLoading() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-48 rounded bg-[color:var(--dopl-sage)]/20" />
        <div className="h-10 w-32 rounded-lg bg-[color:var(--dopl-sage)]/20" />
      </div>

      <div className="space-y-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="glass-card-light rounded-2xl p-5 h-24 flex items-center gap-4"
          >
            <div className="h-10 w-10 rounded-xl bg-[color:var(--dopl-sage)]/20" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-[color:var(--dopl-sage)]/20" />
              <div className="h-3 w-64 rounded bg-[color:var(--dopl-sage)]/10" />
            </div>
            <div className="h-6 w-16 rounded bg-[color:var(--dopl-sage)]/20" />
          </div>
        ))}
      </div>
    </div>
  );
}
