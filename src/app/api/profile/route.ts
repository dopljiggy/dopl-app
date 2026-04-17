import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

const HANDLE_RE = /^[a-z0-9_-]{2,32}$/;

export async function PATCH(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { display_name, handle, bio, links } = body as {
    display_name?: string;
    handle?: string;
    bio?: string;
    links?: { platform: string; url: string }[];
  };

  const normalizedDisplayName = display_name?.trim() ?? "";
  if (!normalizedDisplayName) {
    return NextResponse.json(
      { error: "display name is required" },
      { status: 400 }
    );
  }

  const normalizedHandle = handle?.trim() ?? "";
  if (!normalizedHandle) {
    return NextResponse.json({ error: "handle is required" }, { status: 400 });
  }
  if (!HANDLE_RE.test(normalizedHandle)) {
    return NextResponse.json(
      {
        error:
          "handle must be 2-32 characters, lowercase a-z, 0-9, underscore, or hyphen",
      },
      { status: 400 }
    );
  }

  const payload = {
    display_name: normalizedDisplayName,
    handle: normalizedHandle,
    bio: bio?.trim() || null,
    links: links ?? [],
  };

  const { data: existing } = await supabase
    .from("fund_managers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase
      .from("fund_managers")
      .insert({ id: user.id, ...payload });
    if (error)
      return NextResponse.json(
        {
          error: error.message.includes("unique")
            ? "handle is taken"
            : error.message,
        },
        { status: 400 }
      );
  } else {
    const { error } = await supabase
      .from("fund_managers")
      .update(payload)
      .eq("id", user.id);
    if (error)
      return NextResponse.json(
        {
          error: error.message.includes("unique")
            ? "handle is taken"
            : error.message,
        },
        { status: 400 }
      );
  }

  return NextResponse.json({ ok: true });
}
