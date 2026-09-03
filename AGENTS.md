# TETRA Agent Instructions

## Mission

TETRA is a lightweight employee task/time tracking companion app.

The existing Google Sheet is the official report.

Do not turn this into a spreadsheet clone, surveillance product, or over-engineered platform.

## Read first

Before changing code, read:

1. `PRD.md`
2. `ARCHITECTURE.md`
3. `DESIGN.md`
4. relevant `docs/adr/*`
5. `ROADMAP.md`
6. `TODO.md`

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind
- shadcn/ui
- PostgreSQL
- Drizzle
- Zod
- Google OAuth
- Google Sheets API
- Vitest
- Playwright

Do not introduce a new framework/ORM without an ADR.

## Coding rules

- TypeScript strict.
- Avoid `any`.
- Validate external input.
- Keep business logic outside UI components.
- Use Server Components by default.
- Keep secrets server-side.
- Use migrations for schema changes.
- Store timestamps in UTC.
- Calculate duration server-side.
- Validate overlaps server-side.

## Feature workflow

```text
Requirement
→ Plan
→ Domain/schema
→ Server logic
→ UI
→ Tests
→ Lint/typecheck/build
→ Manual verification
→ Commit
```

## Google Sheets rules

Never:
- hard-code spreadsheet IDs
- overwrite entire rows unnecessarily
- overwrite unrelated notes
- mark sync successful before expected writes complete

Always:
- use configured mappings
- log sync attempts
- make sync idempotent
- show the user what will be written

## AI rules

AI may suggest:
- category
- task name
- cleaned notes
- missing-entry candidates

AI must not:
- silently change time
- silently submit spreadsheet changes
- fabricate work
- become required for core tracking

## n8n rules

n8n is optional.

It may handle:
- reminders
- weekly summaries
- external integrations
- approved automation

It must not own authoritative time entries or core timer calculations.

## Testing

For meaningful features, add tests for:
- duration calculation
- breaks
- aggregation
- overlap detection
- spreadsheet mapping

Critical E2E:

```text
Login
→ Start work
→ Start task
→ Stop task
→ Break
→ Resume
→ Stop work
→ Review
→ Sync
```

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For critical UI changes:

```bash
pnpm test:e2e
```

Never claim a check passed if it did not run.

## Agent task format

Use this structure for implementation plans:

```json
{
  "task": "Add daily activity summary",
  "goal": "Show total work and time by category",
  "files_to_inspect": [],
  "implementation": [],
  "verification": [
    "pnpm test",
    "pnpm lint",
    "pnpm typecheck",
    "pnpm build"
  ],
  "commit": "feat(summary): add daily activity summary"
}
```

## Definition of done

- Behavior matches PRD.
- UI matches DESIGN.
- ADR constraints are respected.
- Tests cover important behavior.
- Checks pass.
- No unrelated changes.
- Documentation updated when behavior/architecture changes.
