// Sends queued push notifications. Trigger: Database Webhook on INSERT into
// public.notification_outbox (with the service-role Authorization header), or a cron.
// The request body is ignored; it only claims and sends what's in the outbox.
import { adminClient, cors, errorResponse, json } from '../_shared/http.ts';
import { sendPending, type ClaimedNotification } from '../_shared/push.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = adminClient();
    const result = await sendPending({
      claim: async (limit) => {
        const { data, error } = await admin.rpc('claim_notifications', { p_limit: limit });
        if (error) throw new Error(error.message);
        return (data ?? []) as ClaimedNotification[];
      },
      recordError: async (id, message) => {
        await admin.rpc('record_notification_error', { p_id: id, p_error: message });
      },
      removeToken: async (token) => {
        await admin.from('push_tokens').delete().eq('token', token);
      },
      fetch,
      expoAccessToken: Deno.env.get('EXPO_ACCESS_TOKEN') ?? undefined,
      pushUrl: Deno.env.get('EXPO_PUSH_URL') ?? undefined, // local tests only
    });
    console.log(result);
    return json(result);
  } catch (e) {
    return errorResponse(e);
  }
});
