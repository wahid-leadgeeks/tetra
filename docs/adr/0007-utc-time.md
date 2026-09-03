# ADR-0007: Store Timestamps in UTC

## Status
Accepted

## Decision
Store timestamps in UTC and group daily reports using the user's IANA timezone.

## Consequence
Database semantics stay consistent and timezone handling is explicit.
