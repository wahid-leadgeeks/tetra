# ADR-0003: Application Database Owns Raw Activity Data

## Status
Accepted

## Decision
PostgreSQL is authoritative for TETRA raw time/activity records. Google Sheets is the reporting projection.

## Consequences
Records are structured, auditable, and sync can be retried safely.
