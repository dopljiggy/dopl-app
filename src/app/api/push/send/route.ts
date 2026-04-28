import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { sendPushToUser } from "@/lib/push";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, title, body: pushBody, url } = body;

  if (!userId || !title) {
    return NextResponse.json(
      { error: "Missing userId or title" },
      { status: 400 }
    );
  }

  const result = await sendPushToUser(
    userId,
    title,
    pushBody ?? "",
    url ?? "/notifications"
  );

  return NextResponse.json(result);
}
