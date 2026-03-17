/*
  Warnings:

  - You are about to drop the `household_invites` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('SAVINGS', 'SPENDING');

-- DropForeignKey
ALTER TABLE "household_invites" DROP CONSTRAINT "household_invites_householdId_fkey";

-- DropForeignKey
ALTER TABLE "household_invites" DROP CONSTRAINT "household_invites_inviteeId_fkey";

-- DropForeignKey
ALTER TABLE "household_invites" DROP CONSTRAINT "household_invites_inviterId_fkey";

-- DropForeignKey
ALTER TABLE "recurring_occurrences" DROP CONSTRAINT "recurring_occurrences_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_categoryId_fkey";

-- AlterTable
ALTER TABLE "recurring_occurrences" ALTER COLUMN "transactionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "recurring_transactions" ADD COLUMN     "installments" INTEGER;

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "categoryId" DROP NOT NULL;

-- DropTable
DROP TABLE "household_invites";

-- DropEnum
DROP TYPE "InviteStatus";

-- CreateTable
CREATE TABLE "split_entries" (
    "id" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "transactionId" TEXT NOT NULL,

    CONSTRAINT "split_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_goals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GoalType" NOT NULL,
    "targetAmount" INTEGER NOT NULL,
    "currentAmount" INTEGER NOT NULL DEFAULT 0,
    "targetDate" TIMESTAMP(3),
    "icon" TEXT NOT NULL DEFAULT 'piggy-bank',
    "color" TEXT NOT NULL DEFAULT '#10b981',
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_entries" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "goalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "householdId" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_tags" (
    "transactionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "transaction_tags_pkey" PRIMARY KEY ("transactionId","tagId")
);

-- CreateIndex
CREATE INDEX "split_entries_transactionId_idx" ON "split_entries"("transactionId");

-- CreateIndex
CREATE INDEX "savings_goals_householdId_idx" ON "savings_goals"("householdId");

-- CreateIndex
CREATE INDEX "goal_entries_goalId_idx" ON "goal_entries"("goalId");

-- CreateIndex
CREATE INDEX "tags_householdId_idx" ON "tags"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_householdId_key" ON "tags"("name", "householdId");

-- CreateIndex
CREATE INDEX "categories_householdId_idx" ON "categories"("householdId");

-- CreateIndex
CREATE INDEX "users_householdId_idx" ON "users"("householdId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_entries" ADD CONSTRAINT "split_entries_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_entries" ADD CONSTRAINT "goal_entries_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "savings_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
