import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { categories } from "../src/server/db/schema";

/**
 * Seeds the global category list from the PRD. Idempotent.
 * Run: pnpm db:seed  (tsx --env-file=.env.local)
 */
const CATEGORIES: { key: string; name: string; sortOrder: number }[] = [
  { key: "website_management", name: "Website Management", sortOrder: 10 },
  { key: "cyber_security", name: "Cyber Security", sortOrder: 20 },
  {
    key: "technology_innovation",
    name: "Technology Optimization & Innovation",
    sortOrder: 30,
  },
  {
    key: "infrastructure_management",
    name: "Infrastructure Management",
    sortOrder: 40,
  },
  { key: "research", name: "Research", sortOrder: 50 },
  { key: "meeting", name: "Meeting", sortOrder: 60 },
  { key: "training", name: "Training", sortOrder: 70 },
  { key: "other_tasks", name: "Other Tasks", sortOrder: 80 },
];

async function main() {
  // Empty-string DATABASE_URL must fall through to the dev default —
  // postgres("") would silently connect as the OS user.
  const url = process.env.DATABASE_URL || "postgresql://tetra:tetra_dev@localhost:5432/tetra";
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  for (const c of CATEGORIES) {
    await db
      .insert(categories)
      .values(c)
      .onConflictDoUpdate({
        target: categories.key,
        set: { name: c.name, sortOrder: c.sortOrder },
      });
  }
  console.log(`Seeded ${CATEGORIES.length} categories`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
