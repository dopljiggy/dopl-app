import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const admin = createAdminClient();

  const { data: fm } = await admin
    .from("fund_managers")
    .select("id, handle, display_name, subscriber_count, avatar_url, bio")
    .ilike("handle", handle)
    .maybeSingle();

  if (!fm) {
    return new Response("not found", { status: 404 });
  }

  const { count: portfolioCount } = await admin
    .from("portfolios")
    .select("id", { count: "exact", head: true })
    .eq("fund_manager_id", fm.id)
    .eq("is_active", true);

  const displayName = fm.display_name || handle;
  const initial = displayName[0]?.toUpperCase() ?? "?";
  const bio = fm.bio ? fm.bio.slice(0, 140) : "";
  const handleText = `@${fm.handle}`;
  const urlText = `dopl-app.vercel.app/${fm.handle}`;

  try {
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
            background: "#0D261F",
            color: "#F3EFE8",
            fontFamily: "system-ui",
          }}
        >
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
              }}
            >
              {initial}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 56, fontWeight: 600, lineHeight: 1.1 }}>
                {displayName}
              </div>
              <div
                style={{
                  fontSize: 28,
                  color: "rgba(243, 239, 232, 0.5)",
                  marginTop: 4,
                }}
              >
                {handleText}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: "rgba(243, 239, 232, 0.7)",
              lineHeight: 1.4,
              maxWidth: 900,
            }}
          >
            {bio}
          </div>

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
                  {String(fm.subscriber_count)}
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
                  {String(portfolioCount ?? 0)}
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
                {urlText}
              </div>
              <div
                style={{
                  fontSize: 16,
                  color: "rgba(243, 239, 232, 0.4)",
                  marginTop: 4,
                }}
              >
                {"live portfolio · real positions"}
              </div>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (e) {
    console.error("[share-card] ImageResponse error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
