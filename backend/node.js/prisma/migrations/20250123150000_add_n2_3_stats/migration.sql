-- CreateTable
CREATE TABLE "DailyIssueStats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AlterTable: Add viewCount to Issue
-- SQLite doesn't support ALTER COLUMN, so we need to check if column exists
-- This is a simplified version assuming fresh migration
ALTER TABLE "Issue" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "DailyIssueStats_date_key" ON "DailyIssueStats"("date");

-- CreateIndex
CREATE INDEX "DailyIssueStats_date_idx" ON "DailyIssueStats"("date");
