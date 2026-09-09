import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type TetraDatabase = PostgresJsDatabase<typeof schema> | PgliteDatabase<typeof schema>;

export type TetraClient = (PGlite | postgres.Sql) & {
  close: () => Promise<unknown>;
};

const globalForDb = globalThis as unknown as {
  __tetra_pglite__?: PGlite;
  __tetra_pg_client__?: postgres.Sql;
  __tetra_db__?: TetraDatabase;
  __tetra_client__?: TetraClient;
};

export function isUsingPostgres(): boolean {
  const dbUrl = process.env.DATABASE_URL || "";
  return (
    (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) &&
    !dbUrl.includes("localhost:5432") &&
    !dbUrl.includes("tetra_dev")
  );
}

export function getPglitePath(): string {
  const isVercel = process.env.VERCEL === "1";
  const baseDir = isVercel ? "/tmp" : process.cwd();
  const dbUrl = process.env.DATABASE_URL || "file:.data/tetra-pglite";
  if (dbUrl.startsWith("file:")) {
    return path.resolve(/*turbopackIgnore: true*/ baseDir, dbUrl.slice(5));
  }
  if (dbUrl.startsWith("pglite://")) {
    return path.resolve(/*turbopackIgnore: true*/ baseDir, dbUrl.slice(9));
  }
  return path.join(baseDir, ".data", "tetra-pglite");
}

function initDb(): { client: TetraClient; db: TetraDatabase } {
  if (globalForDb.__tetra_client__ && globalForDb.__tetra_db__) {
    return { client: globalForDb.__tetra_client__, db: globalForDb.__tetra_db__ };
  }

  const dbUrl = process.env.DATABASE_URL || "file:.data/tetra-pglite";
  const isServerless = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

  if (isUsingPostgres()) {
    const pgClient = postgres(dbUrl, {
      max: isServerless ? 1 : 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    const pgDb = drizzlePostgres(pgClient, { schema }) as unknown as TetraDatabase;

    // Attach close alias so client.close() works for seed/migration scripts
    const clientWithClose = Object.assign(pgClient, {
      close: () => pgClient.end(),
    });

    globalForDb.__tetra_pg_client__ = pgClient;
    globalForDb.__tetra_client__ = clientWithClose;
    globalForDb.__tetra_db__ = pgDb;

    return { client: clientWithClose, db: pgDb };
  }

  const dataDir = getPglitePath();
  fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  // Clean up any stale postmaster.pid left by an abruptly terminated process
  const pidFile = path.join(dataDir, "postmaster.pid");
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
    } catch {
      // Ignore
    }
  }

  const pgliteClient = new PGlite(dataDir);
  const pgliteDb = drizzlePglite(pgliteClient, { schema }) as unknown as TetraDatabase;

  globalForDb.__tetra_pglite__ = pgliteClient;
  globalForDb.__tetra_client__ = pgliteClient;
  globalForDb.__tetra_db__ = pgliteDb;

  const handleExit = () => {
    if (globalForDb.__tetra_pglite__ && !globalForDb.__tetra_pglite__.closed) {
      globalForDb.__tetra_pglite__.close().catch(() => {});
    }
  };
  process.once("beforeExit", handleExit);
  process.once("SIGINT", () => {
    handleExit();
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    handleExit();
    process.exit(0);
  });

  return { client: pgliteClient, db: pgliteDb };
}

let instance: { client: TetraClient; db: TetraDatabase } | null = null;

function getInstance(): { client: TetraClient; db: TetraDatabase } {
  if (!instance) {
    instance = initDb();
  }
  return instance;
}

const db = new Proxy({} as PgliteDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const inst = getInstance();
    const value = Reflect.get(inst.db, prop, receiver);
    if (typeof value === "function") {
      return value.bind(inst.db);
    }
    return value;
  },
});

const client = new Proxy({} as TetraClient, {
  get(_target, prop, receiver) {
    const inst = getInstance();
    const value = Reflect.get(inst.client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(inst.client);
    }
    return value;
  },
});

export { client, db, schema };
