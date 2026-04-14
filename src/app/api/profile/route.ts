import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

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

  // Upsert into fund_managers — supports first save where row may not exist
  const { data: existing } = await supabase
    .from("fund_managers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  const payload = {
    display_name: display_name ?? "",
    handle: handle ?? "",
    bio: bio ?? null,
    links: links ?? [],
  };

  if (!handle) {
    return NextResponse.json({ error: "handle is required" }, { status: 400 });
  }

  if (!existing) {
    const { error } = await supabase
      .from("fund_managers")
      .insert({ id: user.id, ...payload });
    if (error)
      return NextResponse.json(
        { error: error.message.includes("unique") ? "handle is taken" : error.message },
        { status: 400 }
      );
  } else {
    const { error } = await supabase
      .from("fund_managers")
      .update(payload)
      .eq("id", user.id);
    if (error)
      return NextResponse.json(
        { error: error.message.includes("unique") ? "handle is taken" : error.message },
        { status: 400 }
      );
  }

  return NextResponse.json({ ok: true });
}
