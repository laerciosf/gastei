-- Delete orphan households (no members)
DELETE FROM "households" h
WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."householdId" = h."id");

-- AlterTable: add ownerId as nullable first, backfill, then make NOT NULL
ALTER TABLE "households" ADD COLUMN "ownerId" TEXT;

-- Backfill: set ownerId to the first member of each household
UPDATE "households" h
SET "ownerId" = (
  SELECT u."id" FROM "users" u WHERE u."householdId" = h."id" LIMIT 1
);

-- Make NOT NULL after backfill
ALTER TABLE "households" ALTER COLUMN "ownerId" SET NOT NULL;

-- AlterTable: add paid field
ALTER TABLE "recurring_occurrences" ADD COLUMN "paid" BOOLEAN NOT NULL DEFAULT false;
