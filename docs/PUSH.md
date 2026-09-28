# Push notifications

"Jake paid you $20 · Pizza". "Matthew is requesting $20 · Pizza".

## How it works

1. **Queue it with the money.** When money moves, a database trigger on `transactions`
   writes the notification to `notification_outbox` in the same transaction. A
   notification can't be lost, and it can't be sent for a payment that didn't happen.
2. **Settings are checked first.** The trigger honors each person's settings: all
   notifications, "Money received", and "Requests".
3. **Deliver it.** A Database Webhook calls the `push-send` Edge Function. It claims the
   unsent notifications (each one exactly once, even if it runs twice) and sends them to
   every phone the person has registered, through the Expo Push API.
4. **Clean up.** If Expo says a phone is no longer registered (the app was uninstalled),
   its token is deleted.
5. **Open the right screen.** Tapping a notification opens the transaction or the request.
   While the app is open, the in-app banner shows instead of a system alert.

| Event | Who gets it | Text |
| --- | --- | --- |
| Payment | receiver | Jake paid you $20 · Pizza |
| Request | person asked to pay | Matthew is requesting $20 · Pizza |
| Request paid | requester | Jake paid your $20 request · Pizza |
| Request declined | requester | Jake declined your $20 request |

## Setup

1. **EAS project:** `npx eas-cli@latest init` adds `extra.eas.projectId` to the app config.
   Expo push tokens need it.
2. **Push credentials:** `npx eas-cli@latest credentials` sets up APNs (iOS) and FCM
   (Android). Development builds on real phones can then receive pushes.
3. **Deploy the function:** `npx supabase functions deploy push-send`. Optionally set
   `EXPO_ACCESS_TOKEN` if you turned on Expo's enhanced push security.
4. **Add a Database Webhook** (Supabase → Database → Webhooks):
   - Table: `notification_outbox`
   - Event: **Insert**
   - Type: Supabase Edge Function → `push-send`
   - Add the service-role Authorization header.

   The function ignores the request body and just sends whatever is queued, so running
   it extra times is harmless. You can also call it on a schedule as a safety net.
5. **Apply the migrations** in `supabase/migrations` (this step adds
   `20261001090000_push_and_refs.sql`).

Pushes don't work on the web preview or in simulators. On those, Settings → Notifications
explains why.

## Tests

- **Database** (`npm run test:db`): the wording of each message, that settings are
  respected, the push-token rules, and that each notification is claimed only once.
- **Edge Functions** (`deno test -A supabase/functions`): delivery, batches of 100,
  removing dead tokens, and Expo being down.
