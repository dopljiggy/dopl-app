import { ImageResponse } from "next/og";
import { createServerSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const supabase = await createServerSupabase();

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("handle, display_name, subscriber_count, avatar_url, bio")
    .eq("handle", handle)
    .maybeSingle();

  if (!fm) {
    return new Response("not found", { status: 404 });
  }

  const { count: portfolioCount } = await supabase
    .from("portfolios")
    .select("id", { count: "exact", head: true })
    .eq("fund_manager_id", (await supabase.from("fund_managers").select("id").eq("handle", handle).single()).data?.id)
    .eq("is_active", true);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background:
            "linear-gradient(135deg, #0D261F 0%, #1a3a30 60%, #0D261F 100%)",
          color: "#F3EFE8",
          fontFamily: "system-ui",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -180,
            right: -180,
            width: 480,
            height: 480,
            background: "rgba(197, 214, 52, 0.18)",
            borderRadius: "100%",
            filter: "blur(80px)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 28,
              background: "#2D4A3E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
              fontWeight: 700,
              color: "#C5D634",
              overflow: "hidden",
            }}
          >
            {fm.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
              <img
                src={fm.avatar_url}
                width={120}
                height={120}
                style={{ objectFit: "cover" }}
              />
            ) : (
              (fm.display_name || handle)[0]?.toUpperCase()
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 64, fontWeight: 600, lineHeight: 1.1 }}>
              {fm.display_name || handle}
            </div>
            <div
              style={{
                fontSize: 28,
                color: "rgba(243, 239, 232, 0.5)",
                marginTop: 4,
              }}
            >
              @{handle}
            </div>
          </div>
        </div>

        {fm.bio && (
          <div
            style={{
              fontSize: 28,
              color: "rgba(243, 239, 232, 0.7)",
              lineHeight: 1.4,
              maxWidth: 900,
            }}
          >
            {fm.bio.slice(0, 140)}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", gap: 56 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  color: "#C5D634",
                  lineHeight: 1,
                }}
              >
                {fm.subscriber_count}
              </div>
              <div
                style={{
                  fontSize: 20,
                  color: "rgba(243, 239, 232, 0.4)",
                  marginTop: 8,
                }}
              >
                doplers
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  color: "#F3EFE8",
                  lineHeight: 1,
                }}
              >
                {portfolioCount ?? 0}
              </div>
              <div
                style={{
                  fontSize: 20,
                  color: "rgba(243, 239, 232, 0.4)",
                  marginTop: 8,
                }}
              >
                portfolios
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                fontSize: 24,
                color: "#C5D634",
                fontWeight: 600,
              }}
            >
              dopl.com/{handle}
            </div>
            <div
              style={{
                fontSize: 16,
                color: "rgba(243, 239, 232, 0.4)",
                marginTop: 4,
              }}
            >
              live portfolio · real positions
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
