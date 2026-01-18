# TICKET BOOKING SYSTEM


With pessimistic locking, the current code design guarantees:

❌ No double booking

❌ No race conditions

❌ No concurrent writes on the same seat

❌ No partial commits

This solves the hard concurrency problem.

### 💻 TECH STACK 

- NestJS (backend)
- Postgres (database)
- Prisma (ORM)

I’m using Prisma for most of the system, but for the seat-booking flow I deliberately drop down to raw SQL inside a transaction to control locking.

