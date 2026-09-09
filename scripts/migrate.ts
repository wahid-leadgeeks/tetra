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
  await client.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
