/**
 * Activity timer service — thin DB layer over the pure domain
 * (`./domain`). Public API for API routes and server components.
 * Implementation is split by responsibility:
 * - `./entry-queries`    reads (categories, recent tasks, day/current entries)
 * - `./timer-operations` start/stop/pause/resume
 * - `./entry-mutations`  manual create/update/delete
 */
export * from "./entry-mutations";
export * from "./entry-queries";
export * from "./timer-operations";
