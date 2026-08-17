CREATE TABLE "ErrorReport" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ABERTO',
  "severity" TEXT NOT NULL DEFAULT 'ERRO',
  "description" TEXT NOT NULL,
  "pageUrl" TEXT NOT NULL,
  "userAgent" TEXT,
  "errorMessage" TEXT,
  "errorStack" TEXT,
  "consoleLogsJson" TEXT NOT NULL DEFAULT '[]',
  "screenshotData" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ErrorReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ErrorReport_status_createdAt_idx" ON "ErrorReport"("status", "createdAt");
CREATE INDEX "ErrorReport_userId_createdAt_idx" ON "ErrorReport"("userId", "createdAt");
ALTER TABLE "ErrorReport" ADD CONSTRAINT "ErrorReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
