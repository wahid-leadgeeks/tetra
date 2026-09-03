# TETRA Companion App — PRD

## Why are we building this?

The existing Google Sheet is the official Employee Task & Time Tracking report, but filling it every day is tedious. The employee must reconstruct the day, enter IN/BREAK/OUT, distribute time across categories, and write notes.

**TETRA is a companion app, not a replacement for the existing spreadsheet.**

> Record work with minimal friction during the day, calculate time automatically, then synchronize the reviewed result into the existing Google Sheet.

## Product principles

1. Keep the current Google Sheet as the official report.
2. Capture raw activity in the app.
3. Calculate totals automatically.
4. Make start/stop tracking take seconds.
5. Make correction easier than spreadsheet editing.
6. Require review before MVP sync.
7. AI is assistive, never authoritative.
8. Keep the MVP lightweight.

## MVP

### Attendance
- Clock in/out.
- Break start/end.
- Automatic daily/work-time calculation.

### Activity tracking
- Start/stop/pause/resume task.
- Category.
- Task name.
- Notes.
- Manual entry/edit/delete.
- Daily timeline.
- Overlap detection.

### Initial categories
- Website Management
- Cyber Security
- Technology Optimization & Innovation
- Infrastructure Management
- Research
- Meeting
- Training
- Other Tasks

### Daily review
- Attendance total.
- Break total.
- Work total.
- Time by category.
- Missing/overlap warnings.
- Review before sync.

### Google Sheets
- Google OAuth.
- Spreadsheet/tab configuration.
- Configurable date/attendance/category mappings.
- Narrow cell writes only.
- Sync history.
- Retry failed syncs.
- Never overwrite unrelated cells.

## V2
- Google Calendar.
- Recurring/favorite tasks.
- Idle detection.
- Notifications.
- Weekly/monthly analytics.
- Better mapping UI.

## V3
- Natural-language logging.
- AI category/task suggestions.
- AI note cleanup.
- AI missing-entry reconstruction.
- Optional desktop companion.

## Non-goals

- HRIS/payroll replacement.
- Project management platform.
- Employee surveillance.
- Screen recording.
- Silent AI-generated work records.

## Core flow

```text
Start Work
  ↓
Start Task
  ↓
Work
  ↓
Stop / Switch Task
  ↓
Break when needed
  ↓
Clock Out
  ↓
Daily Review
  ↓
Sync to Google Sheet
```

## Success criteria

- Deliberate daily logging takes roughly 1–2 minutes.
- Missing entries can be reconstructed without editing the spreadsheet.
- Category totals are automatic.
- Sync is auditable and retryable.
- User can verify every value before submission.
