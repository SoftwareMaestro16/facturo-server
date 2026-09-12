---
name: db-change
description: Rules for changing prisma/schema.prisma and producing a migration in facturo-server — tenancy, Decimal money, indexes, destructive changes. Use for any schema edit.
---

# Changing the schema

## Every new business table

```prisma
model Thing {
  id        String  @id @default(cuid())
  companyId String
  company   Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([companyId, createdAt])
}
```

`companyId` is not optional and not a convention — it is the boundary between
customers. A table without it has no way to be queried safely.

## Types

| Meaning | Type |
|---|---|
| Money | `Decimal @db.Decimal(12, 2)` |
| Quantity | `Decimal @db.Decimal(12, 3)` |
| VAT rate | `Decimal @db.Decimal(5, 2)` |
| Identifier | `String @id @default(cuid())` |
| Date without time | `DateTime @db.Date` |

`Float` for money is how a total ends up one ban off after a dozen additions.

Prisma returns `Decimal` objects that serialise as `25` for a stored `25.00`.
`DecimalSerializerInterceptor` converts them on the way out; nothing else needs
to remember.

## Indexes

Index what is actually filtered and sorted, in that order:

```prisma
@@index([companyId, direction, status, issueDate])
```

Not every column, and not one index per column.

## Migrations

```bash
npm run prisma:migrate -- --name invoice_number_series
```

The name says what changed and why it matters. `update1` tells the next person
nothing.

To see the SQL without a database:

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
```

## Destructive changes

Renaming or dropping a column is four migrations, not one: add the new column,
backfill it, switch the reads, drop the old one. Doing it in a single step
breaks every running container between the deploy and the migration.

Say this out loud before writing it. It is the part people skip.

## Never

- Edit the database by hand.
- Put the connection string back into `schema.prisma` — Prisma 7 reads it from
  `prisma.config.ts`.
- Run `prisma migrate reset` or `prisma db push` against anything shared.
