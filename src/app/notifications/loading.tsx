export default function NotificationsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 animate-pulse">
      <div className="h-8 w-48 rounded bg-[color:var(--dopl-sage)]/20 mb-6" />

      <div className="h-10 w-full rounded-xl bg-[color:var(--dopl-sage)]/15 mb-6" />

      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="glass-card-light rounded-2xl p-4 h-16 flex items-center gap-3"
          >
            <div className="h-8 w-12 rounded bg-[color:var(--dopl-sage)]/25" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-40 rounded bg-[color:var(--dopl-sage)]/20" />
              <div className="h-3 w-56 rounded bg-[color:var(--dopl-sage)]/10" />
            </div>
            <div className="h-3 w-10 rounded bg-[color:var(--dopl-sage)]/15" />
          </div>
        ))}
      </div>
    </div>
  );
}
