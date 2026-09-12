-- Every account so far has exactly one company. This migration makes that a
-- fact recorded in a table instead of an assumption baked into a foreign key,
-- so a person can join a second one without a schema change.

-- 1. The FK from User to Company becomes optional: a freshly created Google
--    identity has nobody to point at yet.
ALTER TABLE "public"."User" ALTER COLUMN "companyId" DROP NOT NULL;

-- 2. Passwords become optional too: a Google-only account authenticates by
--    its Google subject and never had a password to hash.
ALTER TABLE "public"."User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- 3. The join table. userId+companyId is unique — one person, one role, per
--    company, never two contradictory rows for the same pair.
CREATE TABLE "public"."Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Membership_userId_companyId_key" ON "public"."Membership"("userId", "companyId");
CREATE INDEX "Membership_companyId_idx" ON "public"."Membership"("companyId");

ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Backfill: every existing user becomes an explicit OWNER member of the one
--    company they already had. md5() of a random value is a dependency-free
--    way to generate an opaque id here — Prisma's own cuid() only runs in the
--    application, not inside a migration.
INSERT INTO "public"."Membership" ("id", "userId", "companyId", "role", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text), "id", "companyId", "role", "createdAt"
FROM "public"."User"
WHERE "companyId" IS NOT NULL;

-- 5. New tables read by NestJS only, same as the rest of this schema.
ALTER TABLE "public"."Membership" ENABLE ROW LEVEL SECURITY;
