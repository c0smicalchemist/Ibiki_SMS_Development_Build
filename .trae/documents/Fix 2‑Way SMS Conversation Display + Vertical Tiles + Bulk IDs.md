## Goals
- Show sent reply text in the Conversation dialog for 2‑way SMS
- Enforce vertical stacking for $ Add and $ Deduct tiles in Clients → Actions
- Show bulk message IDs in the same dialog as bulk recipients, with mapping and copy actions

## Findings (Read‑only)
- Conversation dialog (`client/src/components/ConversationDialog.tsx`) merges `incoming` and `outgoing` from `/api/web/inbox/conversation/:phoneNumber`.
- Outgoing entries come from `message_logs`. The message text isn’t stored directly; it’s present in `request_payload` (JSON: `{ recipient, message, ... }`). Current code renders `msg.message` for outgoing, which is undefined → causes an empty bubble.
- The server already logs replies via `/api/web/inbox/reply` with `endpoint: 'web-ui-reply'` and saves `requestPayload`/`responsePayload`.
- Clients table Actions column currently renders two triggers. Table layout can collapse line breaks; need a robust single-column wrapper.
- Message History already has a bulk recipients dialog. We added an IDs dialog earlier; you want IDs consolidated into the same dialog with mapping and copy.

## Changes
1. Conversation Dialog (show outgoing text)
- Parse outgoing `requestPayload` and render message text from `requestPayload.message || requestPayload.content`.
- Fallback to existing `msg.message` if present.
- Keep status and timestamp logic unchanged.

2. Clients → Actions vertical tiles
- Wrap $ Add and $ Deduct triggers in a single-column container (`grid grid-cols-1 gap-2 items-start`) within the TableCell.
- Set each trigger `className` to block width (e.g., `w-28` or `w-full`) to avoid side‑by‑side collapse.

3. Message History bulk dialog (IDs in same pane)
- In the existing recipients dialog, add a second section below recipients:
  - Extract IDs from `responsePayload` (`messageId`, `messageIds`, `ids`, `messages[].messageId`).
  - If count matches recipients, render a two‑column mapping (recipient → ID); else render separate list of IDs.
  - Add Copy All and per‑ID copy buttons.

## Files to Update
- `client/src/components/ConversationDialog.tsx`
- `client/src/pages/AdminDashboard.tsx`
- `client/src/pages/MessageHistory.tsx`

## Validation
- Reply to a conversation; verify outgoing bubble shows the text and status.
- Verify Actions column shows $ Add and $ Deduct stacked vertically on all rows.
- Send bulk SMS; open bulk dialog; see recipients + IDs, mapping where lengths match; test copy.

## Deploy
- Build, commit, push, and restart PM2 on the server.

I’ll implement, build, push, and deploy immediately after your confirmation.