# TETRA Roadmap

MVP (Phases 0–4) is complete and verified: lint/typecheck/build green, 81 unit
tests, critical E2E flow passing.

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
- [ ] Production workbook verification. (requires the production workbook + credentials)

## Phase 5 — Convenience
- [ ] Quick-start tasks.
- [ ] Favorites.
- [ ] Keyboard shortcuts.
- [ ] Mobile polish.
- [ ] Notifications.
- [ ] Weekly summary.
- [ ] Monthly summary.

## Phase 6 — Integrations
- [ ] Google Calendar.
- [ ] Meeting suggestions.
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
