-- Integração Gmail e rastreabilidade de propostas enviadas. Tokens OAuth são
-- armazenados somente em formato criptografado pela aplicação.

CREATE TABLE "EmailIntegration" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastError" TEXT,
    "connectedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalEmail" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "integrationId" TEXT,
    "senderEmail" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "ccEmails" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachmentName" TEXT,
    "attachmentSha256" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PREPARANDO',
    "gmailMessageId" TEXT,
    "gmailThreadId" TEXT,
    "errorMessage" TEXT,
    "sentById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProposalEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailIntegration_provider_key" ON "EmailIntegration"("provider");
CREATE INDEX "EmailIntegration_active_updatedAt_idx" ON "EmailIntegration"("active", "updatedAt");
CREATE INDEX "ProposalEmail_quoteId_createdAt_idx" ON "ProposalEmail"("quoteId", "createdAt");
CREATE INDEX "ProposalEmail_status_createdAt_idx" ON "ProposalEmail"("status", "createdAt");
CREATE INDEX "ProposalEmail_sentById_createdAt_idx" ON "ProposalEmail"("sentById", "createdAt");

ALTER TABLE "EmailIntegration" ADD CONSTRAINT "EmailIntegration_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProposalEmail" ADD CONSTRAINT "ProposalEmail_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalEmail" ADD CONSTRAINT "ProposalEmail_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "EmailIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProposalEmail" ADD CONSTRAINT "ProposalEmail_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
