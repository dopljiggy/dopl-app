export default function SettingsLoading() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8 animate-pulse">
      <div className="h-8 w-32 rounded bg-[color:var(--dopl-sage)]/20 mb-8" />

      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 rounded bg-[color:var(--dopl-sage)]/20" />
            <div className="h-10 w-full rounded-lg bg-[color:var(--dopl-sage)]/15" />
          </div>
        ))}
      </div>
    </div>
  );
}
