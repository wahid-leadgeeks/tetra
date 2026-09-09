import path from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { client, db } from "../src/server/db";

async function main() {
  console.log("Running Drizzle migrations on PGlite...");
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  await migrate(db, { migrationsFolder });
  console.log("Migrations applied successfully.");
  await client.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
