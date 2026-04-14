import { createServerSupabase } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function FundManagerProfile({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const supabase = await createServerSupabase();

  // Fetch fund manager
  const { data: fm } = await supabase
    .from("fund_managers")
    .select("*")
    .eq("handle", handle)
    .single();

  if (!fm) return notFound();

  // Fetch portfolios
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("*")
    .eq("fund_manager_id", fm.id)
    .eq("is_active", true)
    .order("price_cents", { ascending: true });

  return (
    <main className="min-h-screen">
      {/* Banner */}
      <div
        className="h-48 md:h-64 bg-dopl-sage/30 relative"
        style={
          fm.banner_url
            ? { backgroundImage: `url(${fm.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" }
            : {}
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-dopl-deep to-transparent" />
      </div>

      {/* Profile info */}
      <div className="max-w-4xl mx-auto px-6 -mt-16 relative z-10">
        <div className="flex items-end gap-6 mb-8">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-dopl-sage border-4 border-dopl-deep overflow-hidden flex-shrink-0">
            {fm.avatar_url ? (
              <img src={fm.avatar_url} alt={fm.display_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-display text-3xl text-dopl-lime">
                {fm.display_name[0]}
              </div>
            )}
          </div>
          <div className="pb-2">
            <h1 className="font-display text-2xl md:text-3xl font-semibold">{fm.display_name}</h1>
            <p className="text-dopl-cream/50 text-sm">@{fm.handle}</p>
          </div>
          <div className="ml-auto pb-2">
            <div className="glass-card-light px-4 py-2 text-center">
              <p className="font-mono text-2xl text-dopl-lime font-bold">{fm.subscriber_count}</p>
              <p className="text-xs text-dopl-cream/40">subscribers</p>
            </div>
          </div>
        </div>

        {fm.bio && (
          <p className="text-dopl-cream/70 text-sm mb-8 max-w-2xl">{fm.bio}</p>
        )}

        {/* Portfolio tiers */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {portfolios?.map((portfolio) => (
            <div key={portfolio.id} className="glass-card p-6 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-mono font-semibold px-2 py-1 rounded ${
                  portfolio.tier === 'free' ? 'bg-dopl-sage/50 text-dopl-cream/70' :
                  portfolio.tier === 'vip' ? 'bg-dopl-lime/20 text-dopl-lime' :
                  'bg-dopl-sage/30 text-dopl-cream/50'
                }`}>
                  {portfolio.tier}
                </span>
                <span className="font-mono text-lg font-bold text-dopl-lime">
                  {portfolio.price_cents === 0 ? "free" : `$${(portfolio.price_cents / 100).toFixed(0)}/mo`}
                </span>
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">{portfolio.name}</h3>
              {portfolio.description && (
                <p className="text-dopl-cream/50 text-sm mb-4 flex-grow">{portfolio.description}</p>
              )}
              <div className="mt-auto pt-4">
                {portfolio.tier === "free" ? (
                  <Link href={`/feed/${portfolio.id}`} className="block text-center glass-card-light py-2.5 text-sm font-medium hover:bg-dopl-sage/40 transition-colors">
                    view portfolio
                  </Link>
                ) : (
                  <button className="btn-lime w-full text-sm py-2.5">
                    subscribe
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
