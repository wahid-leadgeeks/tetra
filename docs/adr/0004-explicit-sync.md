# ADR-0004: Explicit Review Before Sync

## Status
Accepted

## Decision
MVP uses:

```text
Track → Calculate → Review → Sync
```

## Why
A time-tracking error should not silently become an official reporting error.

## Consequence
Later automatic sync can be added after reliability is proven.
