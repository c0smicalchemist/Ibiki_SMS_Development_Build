## Summary
Add a toggle-driven paraphraser across all send flows (Single, Bulk, Bulk‑Multi, CSV). Generate up to 25 variants per base message, show a preview with per‑variant delete (bin) and replace icons, and distribute variants evenly across recipients. Preserve placeholders/links/opt‑out text, enforce SMS length limits, and keep 1 credit per SMS.

## Pre‑Work (Backup)
- Create a local archive of the current repo and `dist` builds.
- Push a clean baseline branch to Git (e.g., `baseline-before-phrasing`); develop in `feature/ibiki-phraser`.

## UI Changes
- Add “Ibiki Phraser” toggle to all tabs in Send page.
- Controls:
  - Variant count: min 2, default 5, max 25
  - Creativity slider: Conservative ↔ Varied
  - Language select (defaults to current UI language)
- Preview panel:
  - List of generated variants (text, similarity score, length, segment estimate)
  - Per variant actions:
    - Bin icon: delete the variant; reflow distribution to remaining variants
    - Replace icon: regenerate only this slot (same settings) and update preview
    - Optional inline edit: manual tweaks (marked as `userEdited=true`)
  - If more than 10 variants, collapse/expand the extra entries
- Distribution preview:
  - Shows recipient allocation per variant (e.g., 500 recipients → 25 variants × 20 each, remainder assigned round‑robin)
  - Updates live when variants are deleted/added/replaced

## Generation & Safety
- Protect tokens before paraphrasing: `{{placeholders}}`, `%NAME%`, URLs, phone numbers, opt‑out phrases
- Restore tokens after generation; ensure similarity above a threshold
- Enforce GSM7/UCS2 segment policies; flag/warn if variant exceeds allowed length
- Content filter to avoid drift/offensive text; drop variants that fail checks

## Server API
- `POST /api/tools/paraphrase` { text, n, creativity, lang, protections[] } → [{ id, text, score, segments, protectedRestored:true }]
- Cache by hash(text + controls + lang); TTL to avoid recomputation
- Rate limit requests; queue if overloaded

## Send Flow Integration
- Single: with phraser ON, pick top variant or let user choose; log `variantId`
- Bulk: partition recipients into K buckets (K=variants); assign sequentially, round‑robin remainders; log `variantId` per message
- Bulk‑Multi: optionally paraphrase per row (off by default to avoid over‑generation); if ON, generate per unique base text
- CSV: if single message column, treat like bulk; if multiple messages, treat like bulk‑multi
- Normalization/dedup/validation remain unchanged; 1 credit per SMS applies

## Data & Logging
- Add fields to `message_logs`: `variantId`, `baseHash`, `phraserEnabled`, `phraserCount`
- Analytics: variant usage, average DLR, complaint rate per variant

## Model Options
- Phase 1 (fast): containerized paraphraser microservice (RasaHQ) behind `/api/tools/paraphrase`
- Phase 2 (upgrade): switch to modern HF models (PEGASUS/T5) or managed LLM API for quality/latency improvements

## Performance Targets
- Generate up to 25 variants within ~6–8 seconds for short SMS; compute once per base text
- Provide progress indicator; allow cancel and fallback to original text

## Testing
- Unit: token protection, length checks, similarity threshold
- Integration: distribution math, delete/replace behavior
- E2E: sends with paraphraser ON/OFF; DLR/MO unaffected; credits remain 1/SMS

## Rollout & Safety
- Feature behind toggle; default OFF
- Admin can enable/disable per role (admin/supervisor/user)
- Immediate revert by turning toggle OFF; no change to transport or billing

## Deliverables
- UI toggle + controls + preview with bin/replace icons
- Server paraphrase endpoint
- Distribution logic wired into all send paths
- Logging and basic analytics
- Backups completed before any code changes

Confirm and I will proceed to implement on a new branch, after backups.