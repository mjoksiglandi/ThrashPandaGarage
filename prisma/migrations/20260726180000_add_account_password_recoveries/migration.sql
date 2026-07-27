-- CreateTable
CREATE TABLE "AccountPasswordRecovery" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountPasswordRecovery_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountPasswordRecovery_tokenHash_format_check"
        CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "AccountPasswordRecovery_terminal_state_check"
        CHECK (NOT ("consumedAt" IS NOT NULL AND "revokedAt" IS NOT NULL)),
    CONSTRAINT "AccountPasswordRecovery_expires_after_creation_check"
        CHECK ("expiresAt" > "createdAt"),
    CONSTRAINT "AccountPasswordRecovery_consumed_after_creation_check"
        CHECK ("consumedAt" IS NULL OR "consumedAt" >= "createdAt"),
    CONSTRAINT "AccountPasswordRecovery_revoked_after_creation_check"
        CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountPasswordRecovery_tokenHash_key" ON "AccountPasswordRecovery"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountPasswordRecovery_accountId_createdAt_idx" ON "AccountPasswordRecovery"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountPasswordRecovery_expiresAt_idx" ON "AccountPasswordRecovery"("expiresAt");

-- AddForeignKey
ALTER TABLE "AccountPasswordRecovery" ADD CONSTRAINT "AccountPasswordRecovery_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
