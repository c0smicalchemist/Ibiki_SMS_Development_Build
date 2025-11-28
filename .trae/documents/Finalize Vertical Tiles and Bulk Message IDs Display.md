## Summary
You want two vertically stacked credit action tiles ($ Add and $ Deduct) in the Clients table, and bulk message IDs shown alongside bulk recipients in Message History. I’ll adjust the layout to guarantee vertical stacking in all table contexts and enhance the bulk dialog to show extracted message IDs (and mapping to recipients when possible).

## Findings
- Credit actions render from `AddCreditsToClientDialog` in `client/src/pages/AdminDashboard.tsx` within the Clients table. Table cell layout can override inline display without explicit block/grid constraints.
- Bulk recipients UI is in `client/src/pages/MessageHistory.tsx` with a dialog for recipients. The provider response JSON is stored in `message_logs.responsePayload` and can be parsed for IDs.

## Implementation Plan
1. **Vertical Tiles (Clients → Actions column):**
   - Wrap the two triggers in a single-column container (`grid grid-cols-1 gap-2 items-start`).
   - Make each trigger `w-full` (or `w-28` if you prefer a fixed width) with `block` to avoid inline placement.
   - Ensure no parent flex-row style collapses the vertical stack; apply `flex-col` on the wrapper if needed.

2. **Bulk Message IDs Display:**
   - Enhance the existing bulk recipients dialog to include message IDs:
     - Extract IDs from `responsePayload` (supports `messageId`, `messageIds`, `ids`, `messages[].messageId`).
     - Show IDs directly in the same dialog under recipients.
     - If `ids.length === recipients.length`, render recipient → ID pairs; otherwise show separate ID list.
   - Add copy helpers (Copy all IDs, and per-ID copy buttons) for quick export.

3. **Resilience & Edge Cases:**
   - Safely parse invalid JSON and provide graceful fallbacks (`unknown`).
   - Handle large bulk arrays with scrollable container.

4. **Validation:**
   - Build and run locally; verify vertical stack in Clients table across breakpoints.
   - Send a test bulk; confirm IDs render in the dialog and mapping when counts match.
   - Deploy to server; verify in production UI.

## Deliverables
- Updated Clients table with reliably stacked `$ Add` and `$ Deduct` tiles.
- Message History bulk dialog showing recipients and message IDs (with mapping where possible), plus copy actions.
- Build, commit, push, and deployment to the existing server.

Confirm and I’ll implement, verify, and deploy immediately.