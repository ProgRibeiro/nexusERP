CREATE TABLE "MarketingPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "publishDate" TEXT NOT NULL,
    "publishTime" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDEIA',
    "channelsJson" TEXT NOT NULL DEFAULT '[]',
    "format" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingPost_publishDate_status_idx" ON "MarketingPost"("publishDate", "status");
CREATE INDEX "MarketingPost_owner_idx" ON "MarketingPost"("owner");
ALTER TABLE "MarketingPost" ADD CONSTRAINT "MarketingPost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
