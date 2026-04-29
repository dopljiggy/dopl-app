import { getCachedUser } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import ProfileClient from "./profile-client";

export default async function ProfilePage() {
  const { supabase, user } = await getCachedUser();
  if (!user) redirect("/login");

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <ProfileClient
      initial={{
        display_name: fm?.display_name ?? "",
        handle: fm?.handle ?? "",
        bio: fm?.bio ?? "",
        links: Array.isArray(fm?.links) && fm!.links.length
          ? (fm!.links as { platform: string; url: string }[])
          : [{ platform: "x", url: "" }],
      }}
    />
  );
}
