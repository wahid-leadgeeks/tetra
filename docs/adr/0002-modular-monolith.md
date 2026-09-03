# ADR-0002: Use a Modular Monolith

## Status
Accepted

## Decision
Use one Next.js application with PostgreSQL for MVP.

## Why
The product is small. Microservices add operational complexity without solving a current problem.

## Consequences
Simple deployment and development. Extract services only if real scale requires it.
