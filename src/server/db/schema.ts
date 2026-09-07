import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "open",
  "closed",
]);
export const entryStatusEnum = pgEnum("entry_status", [
  "active",
  "paused",
  "completed",
]);
export const entrySourceEnum = pgEnum("entry_source", ["timer", "manual"]);
export const reviewStateEnum = pgEnum("review_state", [
  "draft",
  "ready",
  "reviewed",
  "synced",
  "changed_after_sync",
]);
export const syncStatusEnum = pgEnum("sync_status", [
  "pending",
  "success",
  "failed",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  googleId: text("google_id").unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  image: text("image"),
  timezone: text("timezone").notNull(),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  googleTokenExpiresAt: timestamp("google_token_expires_at", {
    withTimezone: true,
    mode: "date",
  }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    isFavorite: boolean("is_favorite").notNull().default(false),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("tasks_user_name_unique").on(t.userId, t.name)],
);

export const dailyAttendance = pgTable(
  "daily_attendance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workDate: date("work_date", { mode: "string" }).notNull(),
    clockInAt: timestamp("clock_in_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    clockOutAt: timestamp("clock_out_at", {
      withTimezone: true,
      mode: "date",
    }),
    status: attendanceStatusEnum("status").notNull().default("open"),
    reviewState: reviewStateEnum("review_state").notNull().default("draft"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
    lastSyncedAt: timestamp("last_synced_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("daily_attendance_user_date_unique").on(t.userId, t.workDate)],
);

export const breakEntries = pgTable("break_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  attendanceId: uuid("attendance_id")
    .notNull()
    .references(() => dailyAttendance.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const timeEntries = pgTable("time_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
  status: entryStatusEnum("status").notNull().default("active"),
  pausedAt: timestamp("paused_at", { withTimezone: true, mode: "date" }),
  pausedSeconds: integer("paused_seconds").notNull().default(0),
  notes: text("notes"),
  source: entrySourceEnum("source").notNull().default("timer"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const spreadsheetConfigs = pgTable("spreadsheet_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  spreadsheetId: text("spreadsheet_id").notNull(),
  worksheetName: text("worksheet_name").notNull(),
  sheetGid: text("sheet_gid"),
  mapping: jsonb("mapping").notNull(),
  timezone: text("timezone").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const syncLogs = pgTable("sync_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  workDate: date("work_date", { mode: "string" }).notNull(),
  spreadsheetConfigId: uuid("spreadsheet_config_id").references(
    () => spreadsheetConfigs.id,
    { onDelete: "set null" },
  ),
  status: syncStatusEnum("status").notNull().default("pending"),
  payloadHash: text("payload_hash"),
  changedCells: jsonb("changed_cells"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});
