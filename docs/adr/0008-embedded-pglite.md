# ADR-0008: Embedded PGlite Database for Local Development

## Status
Accepted

## Context
Running PostgreSQL in a Docker container requires an active Docker daemon, local container management, and port 5432 availability. When Docker cannot run (e.g. storage relocation, resource constraints, minimal dev environments), local development, automated testing, and CI pipelines were blocked.

## Decision
Adopt PGlite (`@electric-sql/pglite` and `drizzle-orm/pglite`) as the embedded PostgreSQL database for local development, tests, and self-contained environments.

1. PGlite runs true PostgreSQL compiled to WebAssembly directly inside Node.js, requiring zero Docker or system daemon dependencies.
2. Drizzle ORM continues to own schema definitions and queries with 100% PostgreSQL SQL dialect compatibility.
3. Database data is persisted locally in `.data/tetra-pglite/` (ignored by Git).
4. Automated migrations are applied via `drizzle-orm/pglite/migrator` through `pnpm db:migrate`.

## Consequences
- Zero external dependencies or Docker requirement to develop, test, or run TETRA locally.
- 100% compatibility with existing PostgreSQL schemas, foreign keys, timestamps, and indexes.
- Instant, isolated local database initialization and testing.
- Remote PostgreSQL connection strings remain supported if configured in production.
