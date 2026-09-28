# Social feed: what's real and what's still demo

The Feed tab has two views:

- **Just me** shows your own completed payments, with amounts. It works for real accounts, because it is built from your transactions.
- **Friends** shows payments between people you know: who paid whom, the note, likes and comments. It **never** shows friends' amounts.

In the prototype, the friends' payments, likes, comments, favorites and per-payment privacy only exist on the phone. They use demo data in mock mode (`src/data/social.ts`, `src/store/social-store.tsx`).

For real accounts, the Friends feed shows only your own payments that aren't Private until the backend below exists.

## Backend work needed for a live Friends feed

1. **Privacy on payments.**
   - Add `transactions.visibility text not null default 'friends' check (visibility in ('public','friends','private'))`.
   - The `send_money` / `request_money` / `pay_request` RPCs take it as an argument; the app already sends `draft.privacy`.
   - Add an RPC for either party to change it later.
2. **Friend graph.** A `friendships (user_id, friend_id)` table, or derive friends from `contacts` (people you've paid or tapped).
3. **Feed view.**
   - A `feed_items` view or RPC that returns `id, from_user, to_user, note, created_at, visibility`, plus `amount_cents` only when `auth.uid()` is one of the two people.
   - RLS rules:
     - `public` rows are visible to everyone.
     - `friends` rows are visible to friends of either person.
     - `private` rows are visible only to the two people.
4. **Reactions.**
   - Tables: `feed_likes (tx_id, user_id, primary key both)` and `feed_comments (id, tx_id, user_id, body text check (length(body) between 1 and 280), created_at)`.
   - RLS: you can read reactions on any item you can see, and write only as yourself.
5. **Favorites and default privacy.** Store these per user (`user_prefs`) instead of on the device.
6. **Realtime.** Subscribe to `feed_likes` and `feed_comments` for items on screen.

Amounts must be filtered out **on the server**, in the view or RPC. Hiding them only in the app is not enough.
