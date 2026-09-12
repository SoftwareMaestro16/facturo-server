#!/usr/bin/env bash
# SessionStart hook: states the shape of the repository up front.
#
# Cheaper than the alternative. Without it, every fresh session spends a few
# thousand tokens listing directories and opening files to work out where things
# live, and sometimes guesses wrong.
cat <<'BRIEF'
facturo-server — NestJS 12 + Prisma 7 + PostgreSQL. Rules in CLAUDE.md, plan in PLAN.md.

Layout:
  src/modules/<domain>/{dto,model,providers}  model/ is pure: no NestJS, no Prisma, unit tested
  src/common/{guards,filters,interceptors,prisma,utils}
  src/config/                                  env validated at boot, refuses placeholders in prod
  prisma/schema.prisma                         every business table carries companyId; money is Decimal

Commands:
  npm run verify            lint -> typecheck -> test -> build (same as CI)
  npm run test              unit tests, no database needed
  npm run openapi:export    writes openapi.json, the client's only source of types

External boundaries are interfaces with a sandbox implementation, so nothing
here needs SFS credentials or a merchant account to run:
  modules/efactura/providers/efactura-provider.ts
  modules/billing/providers/payment-provider.ts
BRIEF
