import { categories } from "../src/server/db/schema";
import { client, db } from "../src/server/db";

/**
 * Seeds the global category list from the PRD. Idempotent.
 * Run: pnpm db:seed
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
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
