import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/env";
import * as schema from "./schema";

// In serverless environments (Vercel), use max: 1 to prevent connection pool exhaustion
const isServerless = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

const client = postgres(env.DATABASE_URL, {
  max: isServerless ? 1 : 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export { schema };
