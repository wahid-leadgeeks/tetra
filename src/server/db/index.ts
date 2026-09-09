import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __tetra_pglite__?: PGlite;
  __tetra_db__?: PgliteDatabase<typeof schema>;
};

export function getPglitePath(): string {
  const dbUrl = process.env.DATABASE_URL || "file:.data/tetra-pglite";
  if (dbUrl.startsWith("file:")) {
    return path.resolve(/*turbopackIgnore: true*/ process.cwd(), dbUrl.slice(5));
  }
  if (dbUrl.startsWith("pglite://")) {
    return path.resolve(/*turbopackIgnore: true*/ process.cwd(), dbUrl.slice(9));
  }
  if (dbUrl.includes("localhost:5432") || dbUrl.includes("tetra_dev")) {
    // Legacy docker URL fallback -> use local pglite folder
    return path.join(process.cwd(), ".data", "tetra-pglite");
  }
  if (!dbUrl.startsWith("postgres://") && !dbUrl.startsWith("postgresql://")) {
    return path.resolve(/*turbopackIgnore: true*/ process.cwd(), dbUrl);
  }
  return path.join(process.cwd(), ".data", "tetra-pglite");
}

function initPglite(): { client: PGlite; db: PgliteDatabase<typeof schema> } {
  if (globalForDb.__tetra_pglite__ && globalForDb.__tetra_db__) {
    return { client: globalForDb.__tetra_pglite__, db: globalForDb.__tetra_db__ };
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

  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });

  globalForDb.__tetra_pglite__ = client;
  globalForDb.__tetra_db__ = db;

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

  return { client, db };
}

let instance: { client: PGlite; db: PgliteDatabase<typeof schema> } | null = null;

function getInstance(): { client: PGlite; db: PgliteDatabase<typeof schema> } {
  if (!instance) {
    instance = initPglite();
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

const client = new Proxy({} as PGlite, {
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
