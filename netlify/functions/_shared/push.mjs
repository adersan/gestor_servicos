import webpush from "web-push";
import { env, supabase } from "./server.mjs";

let vapidConfigured = false;

function configureWebPush() {
  if (vapidConfigured) return;
  webpush.setVapidDetails(env("VAPID_SUBJECT"), env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
  vapidConfigured = true;
}

export async function sendPushToAllAdmins(payload) {
  const subscriptions = await supabase("/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth_key");
  if (!subscriptions.length) return;
  configureWebPush();
  const body = JSON.stringify(payload);
  await Promise.all(subscriptions.map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_key } },
        body,
        { TTL: 3600, urgency: "high" }
      );
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await supabase(`/rest/v1/push_subscriptions?id=eq.${encodeURIComponent(row.id)}`, { method: "DELETE" }).catch(() => {});
      } else {
        console.error("Falha ao enviar push:", error.message);
      }
    }
  }));
}
