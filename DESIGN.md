# TETRA Companion App — Design

## Design goal

The app should feel dramatically easier than the spreadsheet.

**Do not reproduce the spreadsheet UI.**

The spreadsheet is a dense reporting document. TETRA is a focused interaction tool.

## Primary questions

Every main screen should answer:

1. Am I working?
2. What am I working on?
3. How much have I tracked today?
4. What needs fixing?

## Navigation

```text
Today
Timeline
Tasks
Reports
Settings
```

## Today screen

```text
Wednesday, September 2

🟢 Working

Employee Portal API
Website Management

01:24:37

[ Pause ]       [ Stop ]

Today
Work       3h 15m
Break         58m

[ + Log Activity ]
```

The active task and timer are the visual focus.

## Start task

```text
Start a task

Category
[ Website Management ▼ ]

Task
[ Employee Portal API ]

Recent
[ Fix Login ]
[ Employee Portal ]
[ API Development ]

Notes (optional)
[                         ]

[ Start Timer ]
```

## Timeline

```text
08:45  Website Management
       Employee Portal
       45m

09:30  Cyber Security
       Server review
       45m

10:15  Meeting
       Team meeting
       30m

10:45  Technology
       n8n automation
       1h 15m

12:00  Break
       58m
```

Actions:
- Edit
- Delete
- Add missing entry
- Split entry
- Merge adjacent entries where safe

## Daily review

```text
Daily Review
Sep 2, 2026

Attendance       08:45 → 17:10
Break             1h 03m
Work              7h 22m

Website Management       1h 40m
Cyber Security              45m
Technology                 2h 15m
Infrastructure               30m
Research                     42m
Meeting                      30m
Training                       0m
Other                       1h 00m

[ Fix Issues ]
[ Sync to Google Sheet ]
```

## Error language

Bad:
`Validation error: invalid interval`

Good:
`Two activities overlap`
`Website Management: 09:00–10:00`
`Meeting: 09:45–10:15`
`[ Edit activities ]`

## Idle detection

Never silently discard time.

```text
You were inactive for 35 minutes.

What happened?

[ Break ]
[ Meeting ]
[ Still working ]
[ Don't count ]
[ Edit time ]
```

## Visual rules

- Clean, calm interface.
- Strong typography.
- One primary accent.
- Generous spacing.
- Large touch targets.
- Subtle status colors.
- Avoid spreadsheet-like grids.
- Avoid dashboard clutter.
- Avoid decorative charts on the primary screen.

## Responsive behavior

Desktop:
- sidebar
- large active timer
- timeline + summary

Mobile:
- bottom navigation
- large Start/Stop action
- compact timeline
- sticky active-task control

## Accessibility

- Keyboard accessible.
- Visible focus.
- 44px minimum touch targets.
- Never rely on color alone.
- Explicit form labels.
- Clear confirmation for destructive actions.
