-- CreateTable
CREATE TABLE "DailyIssueStats" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyIssueStats_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "DailyIssueStats_date_key" ON "DailyIssueStats"("date");

-- CreateIndex
CREATE INDEX "DailyIssueStats_date_idx" ON "DailyIssueStats"("date");
