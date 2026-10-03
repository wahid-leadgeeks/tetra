# TETRA Roadmap

MVP (Phases 0–4) is complete and verified: lint/typecheck/build green, unit and
service-level tests passing (`pnpm test`), Playwright E2E suites passing in CI.
Remaining Phase 4 work needs real Google credentials; see
`docs/sheets-production-verification.md`.

## Phase 0 — Foundation
- [x] Initialize Next.js.
- [x] TypeScript strict mode.
- [x] Tailwind + shadcn.
- [x] PostgreSQL + Drizzle.
- [x] Authentication.
- [x] Environment validation.
- [x] CI.
- [x] Vitest + Playwright.
- [x] Seed categories.

## Phase 1 — Attendance
- [x] Clock in/out.
- [x] Break start/end.
- [x] Daily attendance calculation.
- [x] Timezone handling.
- [x] Validation.
- [x] Tests.

## Phase 2 — Activity Timer
- [x] Start/stop.
- [x] Pause/resume.
- [x] Category picker.
- [x] Task creation.
- [x] Recent tasks.
- [x] Timeline.
- [x] Manual entry.
- [x] Edit/delete.
- [x] Overlap validation.

## Phase 3 — Daily Review
- [x] Daily aggregation.
- [x] Category totals.
- [x] Gap detection.
- [x] Overlap warnings.
- [x] Review state.
- [x] Correction workflow.

## Phase 4 — Google Sheets
- [ ] OAuth Sheets permission. (requires a real Google Cloud project)
- [x] Spreadsheet configuration.
- [x] Worksheet configuration.
- [x] Column mapping.
- [x] Date-row matching.
- [x] Sync preview.
- [x] Narrow cell writes.
- [x] Idempotent sync.
- [x] Sync history.
- [x] Retry.
- [x] Failure state.
- [x] Optional file-based sync (.xlsx/.csv upload → download) without Google auth.
- [ ] Production workbook verification. (requires the production workbook + credentials)

## Phase 5 — Convenience
- [x] Quick-start tasks.
- [x] Favorites.
- [x] Keyboard shortcuts.
- [x] Mobile polish.
- [x] Notifications (in-app center, actionable warnings, PWA push).
- [x] Weekly summary.
- [x] Monthly summary.

## Phase 5.5 — September Workflow Friction (from the 2026-09 workbook analysis)
- [x] Today target progress (8h) with projected wrap-up time.
- [x] Auto clock-in when a task starts while not clocked in.
- [x] 1-tap task switcher on the active task card.
- [x] End Break & Resume previous task in one click.
- [x] Timeline inline fill-gap buttons and split-entry dialog.
- [x] ±15m time nudges in the entry edit dialog.
- [x] Category notes compiled into the sheet notes columns (I, K, M, O, Q, S, U, W) with preview toggle and editable preview.

## Phase 5.6 — Shipped beyond the original plan
- [x] Installable PWA (manifest, service worker, offline page).
- [x] Tasks kanban with workflow states and Today focus checklist.
- [x] Dashboard analytics.

## Phase 6 — Integrations
- [x] Google Calendar (event management, Meet links, guest sync).
- [x] Meeting suggestions (calendar events imported with rule-based categories).
- [ ] n8n API/webhook integration.
- [ ] Scheduled reminders.

## Phase 7 — Intelligence
- [ ] Natural-language logging.
- [ ] AI category suggestions.
- [ ] AI note cleanup.
- [ ] AI missing-entry reconstruction.
- [ ] Confirmation workflow.

## Phase 8 — Desktop Companion
Only build if actual usage proves it is needed.
- [ ] Idle detection.
- [ ] Application/window suggestions.
- [ ] Desktop quick-start.
- [ ] Privacy controls.

## Boundary

Do not add surveillance features merely because they are technically possible.
