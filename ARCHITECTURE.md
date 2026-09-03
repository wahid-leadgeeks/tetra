# TETRA Companion App — Architecture

## System shape

```text
Employee
   ↓
Next.js Web App
   ├── UI
   ├── Server Actions / Route Handlers
   └── Domain Services
          ├── Attendance
          ├── Activities
          ├── Daily Summary
          └── Sheets Sync
   ↓
PostgreSQL

Sheets Sync
   ↓
Google Sheets API
   ↓
Existing Official Google Sheet

n8n
   └── Optional external automation
```

## Stack

- Next.js 16
- React 19
- TypeScript
- App Router
- Tailwind CSS
- shadcn/ui
- PostgreSQL
- Drizzle ORM
- Zod
- Google OAuth
- Google Sheets API
- Vitest
- Playwright
- n8n optional

## Architecture decision

Use a **modular monolith** for MVP. No microservices, event bus, Redis, or desktop agent is required.

## Repository structure

```text
src/
├── app/
├── components/
├── features/
│   ├── attendance/
│   ├── activities/
│   ├── daily-summary/
│   └── sheets-sync/
├── server/
│   ├── db/
│   ├── auth/
│   ├── services/
│   └── integrations/
├── lib/
└── tests/

drizzle/
scripts/
docs/adr/
```

## Core entities

```text
User
 ├── DailyAttendance
 ├── TimeEntry
 ├── BreakEntry
 └── Task

Category
 └── Task

SpreadsheetConfig
 └── SyncLog
```

### TimeEntry

```text
id
userId
taskId
categoryId
startedAt
endedAt
status
notes
source
createdAt
updatedAt
```

### DailyAttendance

```text
id
userId
workDate
clockInAt
clockOutAt
status
```

### SpreadsheetConfig

```text
id
userId
spreadsheetId
worksheetName
mappingJson
timezone
active
```

### SyncLog

```text
id
userId
workDate
spreadsheetConfigId
status
payloadHash
changedCells
errorMessage
createdAt
```

## Source of truth

The PostgreSQL database is authoritative for TETRA's raw activities and sync state.

The existing Google Sheet is the official reporting artifact and a synchronized projection.

## Spreadsheet mapping

Never hard-code workbook coordinates throughout the codebase.

Example configuration:

```json
{
  "dateColumn": "A",
  "clockInColumn": "B",
  "breakStartColumn": "C",
  "breakEndColumn": "D",
  "clockOutColumn": "E",
  "dailyTotalColumn": "F",
  "workTotalColumn": "G",
  "categories": {
    "website_management": "EL",
    "cyber_security": "EN",
    "technology_innovation": "EP",
    "infrastructure_management": "ER",
    "research": "FL",
    "meeting": "FN",
    "training": "FP",
    "other_tasks": "FR"
  }
}
```

Treat this as an example only. Production mapping must be verified against the actual workbook.

## Sync flow

```text
Raw entries
  ↓
Calculate summary
  ↓
Validate gaps/overlaps
  ↓
User review
  ↓
Generate payload
  ↓
Hash payload
  ↓
Write mapped cells
  ↓
Record SyncLog
```

Sync must be idempotent and must never overwrite unrelated cells.

## Time handling

- Store timestamps in UTC.
- Store the user's IANA timezone.
- Group daily data using the user's timezone.
- Calculate duration server-side.
- Render duration as H:MM.
- Never trust a client-provided duration.

## API examples

```text
POST /api/attendance/start
POST /api/attendance/stop
POST /api/breaks/start
POST /api/breaks/stop

POST /api/time-entries/start
POST /api/time-entries/stop
POST /api/time-entries
PATCH /api/time-entries/:id
DELETE /api/time-entries/:id

GET  /api/days/:date
POST /api/days/:date/review
POST /api/days/:date/sync
```

## Security

- OAuth secrets server-side only.
- Validate every mutation with Zod.
- Authorize every record by user.
- Audit spreadsheet writes.
- Do not log OAuth tokens.
- Do not collect unnecessary monitoring data.

## Failure handling

Google API failure:
- Preserve local data.
- Mark day `Ready to Sync`.
- Allow retry.

Post-sync edit:
- Mark `Changed After Sync`.
- Require review before resync.

## n8n boundary

n8n is optional automation, not the core runtime.

Good uses:
- reminders
- weekly summaries
- approved sync workflows
- external integrations

Core timer/attendance must work without n8n.
