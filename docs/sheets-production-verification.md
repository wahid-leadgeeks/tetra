# Google Sheets — Production Verification Checklist

Closes the two open Phase 4 items in `ROADMAP.md`: OAuth Sheets permission with
a real Google Cloud project, and verification against the production workbook.
These need real credentials, so a person runs them; nothing here is automated.

**Rule zero:** every write step runs against a **copy** of the production
workbook. The production spreadsheet ID only ever comes from production env
config. If you cannot tell whether `GOOGLE_SPREADSHEET_ID` points at the copy
or production, stop.

## 1. Google Cloud / OAuth

- [ ] Google Cloud project exists with the **Google Sheets API** and **Google
      Calendar API** enabled.
- [ ] OAuth consent screen configured; the test user (or org) is allowed.
- [ ] OAuth client (Web) created. Redirect URI:
      `<APP_URL>/api/auth/callback/google`.
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` set in `.env.local` (dev) and
      in Vercel (prod). Never committed.
- [ ] Sign in with Google. Consent screen lists the scopes requested in
      `src/server/auth.ts`: `spreadsheets` and `calendar.readonly`.
- [ ] `users.google_access_token` / refresh token stored; refresh works after
      the access token expires (wait > 1h or revoke and re-sign-in).

## 2. Read-only connectivity (copy)

- [ ] Make a copy of the production workbook. Put **its** ID/GID/name in
      `.env.local` (`GOOGLE_SPREADSHEET_ID`, `GOOGLE_SHEET_GID`,
      `GOOGLE_SHEET_NAME`).
- [ ] `pnpm test:sheets-online` succeeds: tab resolved by GID, header row and
      date column read.
- [ ] Settings → Spreadsheet: configure the copy; mapping matches the real
      headers (date, IN, BREAK, OUT, daily total, work total, category
      columns, notes columns I, K, M, O, Q, S, U, W).

## 3. Write verification (copy)

For a reviewed day with attendance, a break, and entries in several
categories:

- [ ] Snapshot the copy before (`values:batchGet` with
      `valueRenderOption=FORMULA` for every tab, saved as JSON).
- [ ] Reports → Sync preview: note the planned cells (row number + A1 list).
- [ ] Execute sync. Snapshot after.
- [ ] Diff: only the previewed cells changed, and no formula was replaced:
      ```bash
      python3 ~/.claude/skills/spreadsheet-sync-safety/scripts/diff_snapshots.py \
        before.json after.json --allow "<Tab>!<first>:<last>"
      ```
- [ ] Sync the same day again → sync log shows `changedCells: []`
      (idempotent), and a fresh diff shows no changes.
- [ ] Formula cells in the target row (e.g. totals) are untouched.
- [ ] Notes cells contain the category notes text verbatim, including non-ASCII.
- [ ] A day whose date row is missing fails with "Date row not found" and
      writes nothing.
- [ ] Rename a mapped header in the copy → sync fails closed, writes nothing.
- [ ] An activity crossing midnight in the business timezone lands on the
      correct date row.
- [ ] Pull (sheet → app) for a synced day reproduces the same category totals.

## 4. Known gaps to resolve before production sign-off

These come from reviewing `src/features/sheets-sync/service.ts` against the
sync-safety rules. Changing sync code requires a momus review.

- [ ] **Formula injection in notes.** `writeCells` uses
      `valueInputOption: "USER_ENTERED"` for every cell, including free-text
      notes. A note starting with `=`, `+`, `-` or `@` is parsed as a formula.
      Fix: write notes with `RAW` (or prefix with `'`), keep `USER_ENTERED`
      only for app-built time/number values.
- [ ] **Hand edits are overwritten silently.** `executeSync` overwrites any
      mapped cell whose current value differs from the computed one. It does
      not compare against the last value TETRA wrote (sync log) to detect a
      manual edit and flag a conflict.
- [ ] **Scope breadth.** `spreadsheets` grants access to every sheet the user
      can edit. Consider `drive.file` plus a picker if Google verification
      requires narrower scopes.

## 5. Production cut-over

- [ ] Section 3 passes on the copy, gaps in section 4 resolved or accepted.
- [ ] Production env points at the production workbook; sync one past,
      already-filled day and confirm `changedCells: []` (values match what
      was entered by hand).
- [ ] Sync today; spot-check the row in the sheet.
- [ ] Tick the two Phase 4 boxes in `ROADMAP.md`.
