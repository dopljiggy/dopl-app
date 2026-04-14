import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <span className="font-display text-2xl font-semibold tracking-tight text-dopl-cream">
          dopl
        </span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-dopl-cream/60 hover:text-dopl-cream transition-colors">
            log in
          </Link>
          <Link href="/signup" className="btn-lime text-sm px-5 py-2.5">
            get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="font-display text-5xl md:text-7xl font-semibold leading-[1.1] tracking-tight mb-6">
          your audience.{" "}
          <span className="text-dopl-lime">your fund.</span>{" "}
          your price.
        </h1>
        <p className="text-lg md:text-xl text-dopl-cream/60 max-w-2xl mx-auto mb-10 font-light">
          connect your broker. create portfolio tiers. your followers subscribe
          and see your live positions. you get paid. dopl handles the rest.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/signup" className="btn-lime text-base px-8 py-3.5">
            launch your fund
          </Link>
          <Link
            href="/leaderboard"
            className="text-sm text-dopl-cream/50 hover:text-dopl-cream transition-colors underline underline-offset-4"
          >
            see fund managers →
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <h2 className="font-display text-3xl font-semibold text-center mb-16">
          how it works
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "connect your broker",
              desc: "link your existing brokerage account. dopl reads your positions in real time. you keep trading normally.",
            },
            {
              step: "02",
              title: "create portfolio tiers",
              desc: "set up free and paid portfolios. assign positions. set your price. dopl handles billing through Stripe.",
            },
            {
              step: "03",
              title: "your followers subscribe",
              desc: "share your dopl link. followers pay to see your live portfolio. when you trade, they get notified instantly.",
            },
          ].map((item) => (
            <div key={item.step} className="glass-card p-8">
              <span className="font-mono text-dopl-lime text-sm font-semibold">
                {item.step}
              </span>
              <h3 className="font-display text-xl font-semibold mt-3 mb-3">
                {item.title}
              </h3>
              <p className="text-dopl-cream/50 text-sm leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Math section */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="glass-card p-12">
          <p className="text-dopl-cream/50 text-sm mb-2">the math</p>
          <p className="font-mono text-4xl md:text-5xl text-dopl-lime font-bold mb-4">
            200 subscribers × $49/mo
          </p>
          <p className="font-mono text-2xl text-dopl-cream/80">
            = $9,800/mo in your pocket
          </p>
          <p className="text-dopl-cream/40 text-sm mt-4">
            from the audience you already have. the research you&apos;re already doing. the trades you&apos;re already taking.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-semibold mb-4">
          stop giving away your best trades for free
        </h2>
        <p className="text-dopl-cream/50 mb-8">
          your followers are already copying your positions manually. badly. and late. dopl makes it automatic.
        </p>
        <Link href="/signup" className="btn-lime text-base px-8 py-3.5 inline-block">
          launch your fund
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-dopl-sage/30 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="font-display text-lg text-dopl-cream/40">dopl</span>
          <p className="text-xs text-dopl-cream/30">
            infrastructure for fund managers
          </p>
        </div>
      </footer>
    </main>
  );
}
