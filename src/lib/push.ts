import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase-admin";

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return;
  webpush.setVapidDetails("mailto:pirates@teamdopl.com", pub, priv);
  vapidConfigured = true;
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url: string
): Promise<{ sent: number; expired: number }> {
  ensureVapid();
  if (!vapidConfigured) return { sent: 0, expired: 0 };

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return { sent: 0, expired: 0 };

  const payload = JSON.stringify({
    title,
    body,
    icon: "/apple-touch-icon.png",
    data: { url },
  });

  let sent = 0;
  const expired: string[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
      sent++;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 410 || status === 404) {
        expired.push(sub.id);
      }
    }
  }

  if (expired.length) {
    await admin.from("push_subscriptions").delete().in("id", expired);
  }

  return { sent, expired: expired.length };
}
