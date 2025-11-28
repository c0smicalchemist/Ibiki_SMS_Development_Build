## Goal
Display all message IDs for bulk sends in Message History, similar to the existing bulk recipients tile, so users can quickly view IDs returned by the provider.

## Current Behavior
- MessageHistory shows a per-log `messageId` column; bulk logs often show `unknown`.
- Bulk recipients open a dialog listing phone numbers (`msg.recipients`).
- The server stores `message_logs.responsePayload` which may include message IDs from the provider.

## Approach
1. Safe parsing and extraction:
   - Add a helper to parse `msg.responsePayload` and extract IDs using best-effort strategies:
     - Direct field: `messageId` (single) or array fields: `messageIds`, `ids`, `messages[].messageId`.
     - Fallback: regex scan for ID-like tokens (e.g., `"messageId"\s*:\s*"..."`).
   - Normalize into a string array `extractedIds`.

2. UI additions in `MessageHistory.tsx`:
   - Next to the existing “Bulk (N)” recipients button, add an “IDs (M)” button when bulk log has recipients.
   - Clicking “IDs (M)” opens a second dialog showing the extracted IDs in a grid (font-mono), with clear label “Bulk message IDs”.
   - If `extractedIds` length differs from recipients, show all found IDs and, when none are found, show one of:
     - The single `msg.messageId` if present and not `unknown`.
     - A list of `unknown` placeholders matching recipient count.

3. Mapping display (optional enhancement if data allows):
   - If `extractedIds.length === msg.recipients.length`, render a two-column grid mapping each recipient to its message ID.
   - Otherwise, render IDs as a simple list.

4. Non-invasive server behavior:
   - No server changes required. Uses `responsePayload` already returned in message logs.
   - Future improvement (not in this change): If provider returns per-recipient IDs in a predictable structure, extend server logging to record `perRecipientIds` for exact mapping.

5. Edge cases and UX:
   - Handle null/invalid JSON in `responsePayload` safely.
   - Ensure dialogs handle large arrays (e.g., up to N) with overflow scroll.
   - Preserve existing pagination and status refresh behavior.

## Files To Update
- `client/src/pages/MessageHistory.tsx`
  - Add ID extraction helper.
  - Add second dialog state (`idsOpen`, `bulkIds`).
  - Render “IDs (M)” button and dialog.

## Validation
- Send bulk SMS; open Message History; click “Bulk (N)” and “IDs (M)” to verify lists.
- For responses without IDs, confirm placeholders appear.
- Ensure standard single-send entries are unaffected.

## Rollback
- The change is UI-only. Revert the new dialog/button and helper if needed.

Confirm to proceed and I’ll implement, build, push, and deploy.