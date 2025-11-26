import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * Apply lightweight SQLite DDL for e2e tests so we don't depend on
 * prisma migrate during CI. These statements mirror the Prisma schema.
 */
export async function applyTestMigrations(prisma: PrismaService) {
  const statements = [
    'PRAGMA foreign_keys = ON;',
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "email" TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "nickname" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS "Project" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS "Issue" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "projectId" INTEGER NOT NULL,
      "reporterId" INTEGER NOT NULL,
      "assigneeId" INTEGER,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "viewCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS "Comment" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "issueId" INTEGER NOT NULL,
      "authorId" INTEGER NOT NULL,
      "content" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS "Team" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS "TeamMember" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "teamId" INTEGER NOT NULL,
      "userId" INTEGER NOT NULL,
      "role" TEXT NOT NULL,
      "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      UNIQUE("teamId", "userId")
    );`,
    `CREATE TABLE IF NOT EXISTS "WorkspaceItem" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "teamId" INTEGER NOT NULL,
      "title" TEXT NOT NULL,
      "content" TEXT,
      "createdBy" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS "DailyIssueStats" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "date" TEXT NOT NULL UNIQUE,
      "createdCount" INTEGER NOT NULL DEFAULT 0,
      "resolvedCount" INTEGER NOT NULL DEFAULT 0,
      "commentCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS "Product" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "category" TEXT NOT NULL,
      "brand" TEXT NOT NULL,
      "price" REAL NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS "Order" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL,
      "totalAmount" REAL NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS "OrderItem" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "orderId" INTEGER NOT NULL,
      "productId" INTEGER NOT NULL,
      "quantity" INTEGER NOT NULL,
      "price" REAL NOT NULL,
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS "Notification" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL,
      "type" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    'CREATE INDEX IF NOT EXISTS "Issue_projectId_idx" ON "Issue"("projectId");',
    'CREATE INDEX IF NOT EXISTS "Issue_reporterId_idx" ON "Issue"("reporterId");',
    'CREATE INDEX IF NOT EXISTS "Issue_assigneeId_idx" ON "Issue"("assigneeId");',
    'CREATE INDEX IF NOT EXISTS "Issue_status_idx" ON "Issue"("status");',
    'CREATE INDEX IF NOT EXISTS "Comment_issueId_idx" ON "Comment"("issueId");',
    'CREATE INDEX IF NOT EXISTS "Comment_authorId_idx" ON "Comment"("authorId");',
    'CREATE INDEX IF NOT EXISTS "TeamMember_teamId_idx" ON "TeamMember"("teamId");',
    'CREATE INDEX IF NOT EXISTS "TeamMember_userId_idx" ON "TeamMember"("userId");',
    'CREATE INDEX IF NOT EXISTS "WorkspaceItem_teamId_idx" ON "WorkspaceItem"("teamId");',
    'CREATE INDEX IF NOT EXISTS "WorkspaceItem_createdBy_idx" ON "WorkspaceItem"("createdBy");',
    'CREATE UNIQUE INDEX IF NOT EXISTS "DailyIssueStats_date_key" ON "DailyIssueStats"("date");',
    'CREATE INDEX IF NOT EXISTS "DailyIssueStats_date_idx" ON "DailyIssueStats"("date");',
    'CREATE INDEX IF NOT EXISTS "Product_category_idx" ON "Product"("category");',
    'CREATE INDEX IF NOT EXISTS "Product_brand_idx" ON "Product"("brand");',
    'CREATE INDEX IF NOT EXISTS "Product_status_idx" ON "Product"("status");',
    'CREATE INDEX IF NOT EXISTS "Product_price_idx" ON "Product"("price");',
    'CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "Order"("userId");',
    'CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");',
    'CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");',
    'CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");',
    'CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");',
    'CREATE INDEX IF NOT EXISTS "Notification_type_idx" ON "Notification"("type");',
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
}
