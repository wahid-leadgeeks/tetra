/**
 * Imports the verified September 1–4, 2026 tracking data from the official
 * Google Sheet report ("September 2026 - Employee Task & Time Tracking - Google Sheets.pdf")
 * into the TETRA database for testing Timeline, Daily Review, and Monthly views.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-september-tracking.ts [--email=wahid@leadgeeks.com] [--name=Wahid]
 */
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../src/server/db";
import {
  breakEntries,
  categories,
  dailyAttendance,
  spreadsheetConfigs,
  tasks,
  timeEntries,
  users,
} from "../src/server/db/schema";
import { DEFAULT_SHEET_MAPPING } from "../src/features/sheets-sync/mapping";

interface DayPlan {
  date: string; // YYYY-MM-DD
  clockIn: string; // HH:MM in Asia/Jakarta
  clockOut: string; // HH:MM in Asia/Jakarta
  breaks: { start: string; end: string }[];
  entries: {
    categoryKey: "meeting" | "training";
    taskName: string;
    notes: string;
    start: string; // HH:MM in Asia/Jakarta
    end: string; // HH:MM in Asia/Jakarta
  }[];
}

const SEPTEMBER_DATA: DayPlan[] = [
  {
    date: "2026-09-01",
    clockIn: "08:30",
    clockOut: "20:20",
    breaks: [{ start: "12:50", end: "15:00" }],
    entries: [
      // Meeting (1h 40m = 100m)
      {
        categoryKey: "meeting",
        taskName: "Onboarding Wahid - Information Technology",
        notes: "Onboarding Wahid - Information Technology",
        start: "08:30",
        end: "09:10",
      },
      {
        categoryKey: "meeting",
        taskName: "Special Event for Wahid on LeadGeeks",
        notes: "Special Event for Wahid on LeadGeeks",
        start: "09:10",
        end: "09:40",
      },
      {
        categoryKey: "meeting",
        taskName: "Filling Time and Task Tracking",
        notes: "Filling Time and Task Tracking",
        start: "09:40",
        end: "10:10",
      },
      // Training (8h 00m = 480m)
      {
        categoryKey: "training",
        taskName: "Welcoming Message from CEO & MD",
        notes: "Welcoming Message from CEO\nWelcoming Message from MD",
        start: "10:10",
        end: "10:50",
      },
      {
        categoryKey: "training",
        taskName: "Introduction to LeadGeeks",
        notes: "Introduction to LeadGeeks",
        start: "10:50",
        end: "11:30",
      },
      {
        categoryKey: "training",
        taskName: "Introduction to Human Resource Department",
        notes: "Introduction to Human Resource Department",
        start: "11:30",
        end: "12:10",
      },
      {
        categoryKey: "training",
        taskName: "Company Policies & Employee Handbook",
        notes: "Company Policies & Employee Handbook",
        start: "12:10",
        end: "12:50",
      },
      // 12:50 - 15:00 Break
      {
        categoryKey: "training",
        taskName: "Personnel Administration",
        notes: "Personnel Administration (09:00 - 10:00 overview)",
        start: "15:00",
        end: "15:40",
      },
      {
        categoryKey: "training",
        taskName: "Introduction to Management Team",
        notes: "Introduction to Management Team",
        start: "15:40",
        end: "16:20",
      },
      {
        categoryKey: "training",
        taskName: "Experience Department Introduction",
        notes: "Experience Department Introduction",
        start: "16:20",
        end: "17:00",
      },
      {
        categoryKey: "training",
        taskName: "Writing summary of onboarding",
        notes: "Writing summary of onboarding",
        start: "17:00",
        end: "17:40",
      },
      {
        categoryKey: "training",
        taskName: "IT Department Introduction",
        notes: "IT Department Introduction",
        start: "17:40",
        end: "18:20",
      },
      {
        categoryKey: "training",
        taskName: "Growth Department Introduction",
        notes: "Growth Department Introduction",
        start: "18:20",
        end: "19:00",
      },
      {
        categoryKey: "training",
        taskName: "Operations Department Introduction",
        notes: "Operations Department Introduction",
        start: "19:00",
        end: "19:40",
      },
      {
        categoryKey: "training",
        taskName: "Onboarding summary & review wrap-up",
        notes: "Independent wrap-up and documentation review",
        start: "19:40",
        end: "20:20",
      },
    ],
  },
  {
    date: "2026-09-02",
    clockIn: "08:45",
    clockOut: "18:15",
    breaks: [{ start: "12:00", end: "13:30" }],
    entries: [
      // Meeting (2h 05m = 125m)
      {
        categoryKey: "meeting",
        taskName: "Introduction to the IT Department",
        notes: "Introduction to the IT Department",
        start: "08:45",
        end: "10:50",
      },
      // Training (5h 55m = 355m)
      {
        categoryKey: "training",
        taskName: "Introduction to Finance & Accounting",
        notes: "Introduction to Finance & Accounting",
        start: "10:50",
        end: "12:00",
      },
      // 12:00 - 13:30 Break
      {
        categoryKey: "training",
        taskName: "Independent learning, writing summary",
        notes: "Independent learning, writing summary",
        start: "13:30",
        end: "15:55",
      },
      {
        categoryKey: "training",
        taskName: "Creating presentation about LeadGeeks",
        notes: "Creating presentation about LeadGeeks",
        start: "15:55",
        end: "18:15",
      },
    ],
  },
  {
    date: "2026-09-03",
    clockIn: "08:30",
    clockOut: "18:00",
    breaks: [{ start: "12:35", end: "14:05" }],
    entries: [
      // Meeting (2h 35m = 155m)
      {
        categoryKey: "meeting",
        taskName: "How IT Works at LeadGeeks",
        notes: "How IT Works at LeadGeeks",
        start: "08:30",
        end: "11:05",
      },
      // Training (5h 25m = 325m)
      {
        categoryKey: "training",
        taskName: "Reviewed the IT Operational Guide",
        notes: "Reviewed the IT Operational Guide (Part 1)",
        start: "11:05",
        end: "12:35",
      },
      // 12:35 - 14:05 Break
      {
        categoryKey: "training",
        taskName: "Reviewed the IT Operational Guide",
        notes: "Reviewed the IT Operational Guide (Part 2)",
        start: "14:05",
        end: "15:05",
      },
      {
        categoryKey: "training",
        taskName: "Preparing presentation about LeadGeeks",
        notes: "Preparing presentation about LeadGeeks",
        start: "15:05",
        end: "18:00",
      },
    ],
  },
  {
    date: "2026-09-04",
    clockIn: "08:30",
    clockOut: "16:20",
    breaks: [{ start: "11:30", end: "13:00" }],
    entries: [
      // Meeting (3h 35m = 215m)
      {
        categoryKey: "meeting",
        taskName: "Understanding the Current IT Architecture",
        notes: "Understanding the Current IT Architecture",
        start: "08:30",
        end: "10:35",
      },
      // Training (2h 45m = 165m)
      {
        categoryKey: "training",
        taskName: "Independent learning and exploration",
        notes: "Independent learning and exploration (Morning)",
        start: "10:35",
        end: "11:30",
      },
      // 11:30 - 13:00 Break
      {
        categoryKey: "meeting",
        taskName: "Final Practice for Time & Task Tracking",
        notes: "Final Practice for Time & Task Tracking",
        start: "13:00",
        end: "14:30",
      },
      {
        categoryKey: "training",
        taskName: "Independent learning and exploration",
        notes: "Independent learning and exploration (Afternoon)",
        start: "14:30",
        end: "16:20",
      },
    ],
  },
];

/** Parse Asia/Jakarta local date and time string into a UTC Date */
function toUtc(dateStr: string, timeStr: string, tzOffsetHours = 7): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  // UTC = Local time minus tzOffset
  return new Date(Date.UTC(year, month - 1, day, hour - tzOffsetHours, minute));
}

async function main() {
  const args = process.argv.slice(2);
  const emailArg = args.find((a) => a.startsWith("--email="))?.split("=")[1];
  const nameArg = args.find((a) => a.startsWith("--name="))?.split("=")[1];

  const targetEmail = emailArg || "wahid@leadgeeks.com";
  const targetName = nameArg || "Wahid";
  const timezone = "Asia/Jakarta";

  console.log(`Importing September 2026 data for user: ${targetName} <${targetEmail}>`);

  // 1. Upsert user
  let user = (
    await db.select().from(users).where(eq(users.email, targetEmail)).limit(1)
  )[0];

  if (!user) {
    const [created] = await db
      .insert(users)
      .values({
        name: targetName,
        email: targetEmail,
        timezone,
      })
      .returning();
    user = created;
    console.log(`Created user ${user.name} (${user.id})`);
  } else {
    console.log(`Found existing user ${user.name} (${user.id})`);
  }

  // 2. Fetch seeded categories
  const allCategories = await db.select().from(categories);
  const categoryMap = new Map(allCategories.map((c) => [c.key, c.id]));

  for (const required of ["meeting", "training"] as const) {
    if (!categoryMap.has(required)) {
      throw new Error(`Required category "${required}" not found in database. Run pnpm db:seed first.`);
    }
  }

  // 3. Clear existing attendance, breaks, and time entries for September 1–4 for this user (idempotent)
  const dates = SEPTEMBER_DATA.map((d) => d.date);

  const existingAttendance = await db
    .select({ id: dailyAttendance.id })
    .from(dailyAttendance)
    .where(
      and(
        eq(dailyAttendance.userId, user.id),
        inArray(dailyAttendance.workDate, dates),
      ),
    );

  if (existingAttendance.length > 0) {
    const attIds = existingAttendance.map((a) => a.id);
    await db.delete(breakEntries).where(inArray(breakEntries.attendanceId, attIds));
    await db.delete(dailyAttendance).where(inArray(dailyAttendance.id, attIds));
  }

  // Delete time entries for this user overlapping the date range
  const rangeStart = toUtc(dates[0], "00:00");
  const rangeEnd = toUtc(dates[dates.length - 1], "23:59");
  const userTimeEntries = await db
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, user.id),
        gte(timeEntries.startedAt, rangeStart),
        lte(timeEntries.startedAt, rangeEnd),
      ),
    );

  if (userTimeEntries.length > 0) {
    await db
      .delete(timeEntries)
      .where(inArray(timeEntries.id, userTimeEntries.map((t) => t.id)));
  }

  // 4. Create tasks and entries for each day
  for (const day of SEPTEMBER_DATA) {
    console.log(`\nImporting ${day.date}...`);

    const clockInAt = toUtc(day.date, day.clockIn);
    const clockOutAt = toUtc(day.date, day.clockOut);

    // Create daily attendance
    const [att] = await db
      .insert(dailyAttendance)
      .values({
        userId: user.id,
        workDate: day.date,
        clockInAt,
        clockOutAt,
        status: "closed",
        reviewState: "reviewed",
        reviewedAt: clockOutAt,
      })
      .returning();

    // Create break entries
    for (const b of day.breaks) {
      const startedAt = toUtc(day.date, b.start);
      const endedAt = toUtc(day.date, b.end);
      await db.insert(breakEntries).values({
        userId: user.id,
        attendanceId: att.id,
        startedAt,
        endedAt,
      });
      console.log(`  Break: ${b.start} – ${b.end}`);
    }

    // Create tasks and time entries
    for (const entry of day.entries) {
      const categoryId = categoryMap.get(entry.categoryKey)!;

      // Upsert task
      let task = (
        await db
          .select()
          .from(tasks)
          .where(and(eq(tasks.userId, user.id), eq(tasks.name, entry.taskName)))
          .limit(1)
      )[0];

      if (!task) {
        const [createdTask] = await db
          .insert(tasks)
          .values({
            userId: user.id,
            name: entry.taskName,
            categoryId,
            lastUsedAt: toUtc(day.date, entry.end),
          })
          .returning();
        task = createdTask;
      } else {
        await db
          .update(tasks)
          .set({ lastUsedAt: toUtc(day.date, entry.end) })
          .where(eq(tasks.id, task.id));
      }

      // Create completed time entry
      const startedAt = toUtc(day.date, entry.start);
      const endedAt = toUtc(day.date, entry.end);

      await db.insert(timeEntries).values({
        userId: user.id,
        taskId: task.id,
        categoryId,
        startedAt,
        endedAt,
        status: "completed",
        notes: entry.notes,
        source: "manual",
      });

      console.log(`  [${entry.categoryKey.toUpperCase()}] ${entry.start}–${entry.end}: ${entry.taskName}`);
    }
  }

  // 5. Upsert SpreadsheetConfig with verified DEFAULT_SHEET_MAPPING
  const existingConfig = await db
    .select()
    .from(spreadsheetConfigs)
    .where(and(eq(spreadsheetConfigs.userId, user.id), eq(spreadsheetConfigs.active, true)))
    .limit(1);

  const spreadsheetId =
    process.env.GOOGLE_SPREADSHEET_ID ||
    "1Rup5jNnSu-oTcOlZC3zIN7MNfzHqcP_rNrhnLIsX89Y";
  const worksheetName = process.env.GOOGLE_SHEET_NAME || "Wahid";
  const sheetGid = process.env.GOOGLE_SHEET_GID || "1976323691";

  if (existingConfig.length > 0) {
    await db
      .update(spreadsheetConfigs)
      .set({
        spreadsheetId,
        worksheetName,
        sheetGid,
        mapping: DEFAULT_SHEET_MAPPING,
        timezone,
        updatedAt: new Date(),
      })
      .where(eq(spreadsheetConfigs.id, existingConfig[0].id));
    console.log("\nUpdated active spreadsheet config with verified column mapping.");
  } else {
    await db.insert(spreadsheetConfigs).values({
      userId: user.id,
      spreadsheetId,
      worksheetName,
      sheetGid,
      mapping: DEFAULT_SHEET_MAPPING,
      timezone,
      active: true,
    });
    console.log("\nCreated active spreadsheet config with verified column mapping.");
  }

  console.log("\n✓ Successfully imported September 1–4, 2026 data into TETRA!");
  console.log(`You can now sign in as "${targetEmail}" via Dev Login (/login) to test Timeline, Daily Review, and Reports.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
