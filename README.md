# TETRA

**TETRA — Task, Employee, Time & Resource Analytics**

TETRA is a lightweight companion app that automates daily Employee Task & Time Tracking.

It does **not** replace the existing Google Sheet. It captures activities, calculates the day, and synchronizes the reviewed result into the existing report.

## Requirements

- Node.js 22+
- pnpm
- PostgreSQL
- Google Cloud project with Sheets API enabled

Optional:
- n8n

## Setup

```bash
git clone <repository>
cd tetra
pnpm install
cp .env.example .env.local
```

Example:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/tetra
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APP_URL=http://localhost:3000
DEFAULT_TIMEZONE=Asia/Jakarta
```

Never commit `.env.local`.

## Database

```bash
pnpm db:migrate
pnpm db:seed
```

## Development

```bash
pnpm dev
```

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Suggested scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "db:migrate": "drizzle-kit migrate",
  "db:generate": "drizzle-kit generate",
  "db:seed": "tsx scripts/seed.ts"
}
```

## Google Sheets

TETRA can sync the reviewed day two ways — both use the same column mapping
and the same audit trail:

- **Google Sheets** (needs a spreadsheet ID + Google credentials): direct
  narrow cell writes to the live workbook.
- **File sync** (no Google account): on the Reports page, upload the report
  workbook (`.xlsx` or `.csv`), and download it back with exactly the mapped
  cells updated. Nothing is stored server-side.

Configure (shared by both paths):
- spreadsheet ID (Google path only)
- worksheet/tab name
- date-row strategy
- attendance columns
- break columns
- category columns
- notes columns

Do not assume a screenshot is enough to define the production mapping. Verify the actual workbook.

## Development order

```text
Auth
→ Attendance
→ Activity timer
→ Timeline
→ Daily summary
→ Manual correction
→ Google Sheets sync
→ Calendar
→ Idle detection
→ AI
→ n8n
```

## Repository

```text
src/
drizzle/
scripts/
tests/
docs/adr/
public/
.env.example
AGENTS.md
ARCHITECTURE.md
DESIGN.md
PRD.md
README.md
ROADMAP.md
TODO.md
```

## Production sync safety

Before production sync:
1. Test against a copy of the workbook.
2. Verify exact cells affected.
3. Verify unrelated cells are unchanged.
4. Test duplicate sync.
5. Test retry after failure.
6. Verify production mapping.
