import path from "node:path";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { client, db, isUsingPostgres } from "../src/server/db";

async function main() {
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  if (isUsingPostgres()) {
    console.log("Running Drizzle migrations on PostgreSQL...");
    await migratePostgres(db as unknown as Parameters<typeof migratePostgres>[0], { migrationsFolder });
  } else {
    console.log("Running Drizzle migrations on PGlite...");
    await migratePglite(db as unknown as Parameters<typeof migratePglite>[0], { migrationsFolder });
  }
  console.log("Migrations applied successfully.");
  await reconcileHistoricalTasks();
  await client.close();
}

async function reconcileHistoricalTasks() {
  try {
    const { tasks, timeEntries } = await import("../src/server/db/schema");
    const { and, eq, sql } = await import("drizzle-orm");
    const todoTasks = await db.select().from(tasks).where(eq(tasks.status, "todo"));
    let reconciled = 0;
    for (const task of todoTasks) {
      const completed = await db
        .select({
          count: sql`count(*)`,
          firstStart: sql`min(${timeEntries.startedAt})`,
          lastEnd: sql`max(${timeEntries.endedAt})`,
        })
        .from(timeEntries)
        .where(and(eq(timeEntries.taskId, task.id), eq(timeEntries.status, "completed")));

      const count = Number(completed[0]?.count || 0);
      if (count > 0) {
        const firstStart = completed[0].firstStart ? new Date(completed[0].firstStart as string) : null;
        const lastEnd = completed[0].lastEnd ? new Date(completed[0].lastEnd as string) : null;
        await db
          .update(tasks)
          .set({
            status: "done",
            startedAt: firstStart,
            completedAt: lastEnd,
            lastUsedAt: lastEnd || task.lastUsedAt,
          })
          .where(eq(tasks.id, task.id));
        reconciled++;
      }
    }
    if (reconciled > 0) {
      console.log(`Reconciled ${reconciled} historical tasks to done.`);
    }
  } catch (err) {
    console.warn("Task reconciliation skipped:", err);
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
