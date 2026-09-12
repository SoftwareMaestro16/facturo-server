---
name: security-audit
description: The security checklist for facturo-server, as questions to answer against a diff. Use before merging changes to auth, sessions, tenancy, payments or any new endpoint.
---

# Security review

Answer each question against the actual diff, not from memory of the design.

## Tenancy — check this first

- Does every Prisma call added or changed filter by `companyId`?
- Is `companyId` ever taken from the request body or a query parameter instead
  of the token?
- Does a nested relation query inherit the filter, or only the top level?

A missing filter is the most severe finding possible here. Report it first,
name the exact query, and do not bury it under style notes.

## Authentication

- Is any new route `@Public()`? Why, and is the reason written down?
- Do login failures answer identically for unknown account, wrong password and
  locked account? A different message or a different timing is an enumeration
  oracle.
- Does refresh rotate the token and revoke the old one?
- Does a password change revoke every session?

## Secrets and logs

- Anything hard-coded that belongs in `config`.
- Any log line carrying a password, a token, or a full request body on an auth
  route.
- Any new environment variable missing from `.env.example`, or present there
  with a real value instead of a `change_me` placeholder.

## Input

- Does every new DTO validate at the boundary? `whitelist` rejects undeclared
  fields, but it cannot make a declared field sane.
- Is any file upload bounded in size and type?

## Money and payments

- Any `Float` anywhere near an amount.
- Any arithmetic on amounts outside `common/utils/money.ts`.
- Is the payment callback signature verified before anything is written, and
  compared in constant time?
- Can a callback be replayed to credit the same subscription twice?

## Reporting

Most severe first. Each finding: file and line, what a real attacker or a real
customer gets out of it, and the smallest fix. Say plainly when nothing was
found.
