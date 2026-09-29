# Group chat

Group chats let friends talk and split bills in the conversation:
- Start a group from **Chats**. Open Chats with the speech-bubble button on Home or in the Feed.
- Send messages.
- Tap **+** to split a bill evenly between the people you choose.
- Everyone sees each person's share. People who owe you get a **Pay** button, and that button opens the normal payment screen (Face ID or PIN, $500 daily limit).
- Each payment posts "X paid Y" in the chat and ticks the share off.

## What's real in the prototype

- Paying your share is a real test-money payment through `services/payments.ts`, the same as any other payment.
- Chats, messages and splits live **on the phone only** (`src/store/chat-store.tsx`). They reset when the app restarts.
- In mock mode, the seeded chats are demo data. Demo friends type back and pay their shares a few seconds after you post a split, and that money lands in your test balance.
- With a live backend, you start with no chats, and nobody else sees your messages yet.

## Backend work needed for real accounts

1. **Tables**
   - `chats (id, name, created_by, created_at)`
   - `chat_members (chat_id, user_id, joined_at)`
   - `chat_messages (id, chat_id, user_id, kind, body jsonb, created_at)`, where `kind` is one of `text`, `split`, `payment` or `system`
   - `splits (id, chat_id, owner_id, note, total_cents)`
   - `split_shares (split_id, user_id, cents, paid_tx_id)`
2. **RLS**
   - Only members can read a chat, its messages and its splits.
   - You can post only as yourself.
   - Only the owner can create a split.
3. **Paying a share**
   - The `send_money` RPC takes an optional `split_id`.
   - In the same transaction, it marks the share paid and inserts the "paid" message, so the chat can never disagree with the money.
   - The amount must equal the share, and the recipient must be the split's owner.
4. **Realtime:** subscribe to `chat_messages` and `split_shares` for chats you're in.
5. **Push:** a notification for new messages and new splits, using the existing outbox trigger.
6. **Moderation:** members can leave a group and report a message.
