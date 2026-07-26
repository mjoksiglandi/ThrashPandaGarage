-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('INVITED', 'ACTIVE', 'LOCKED', 'DISABLED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'INVITED',
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Account_email_canonical_check"
        CHECK ("email" <> '' AND "email" = lower(btrim("email"))),
    CONSTRAINT "Account_failedLoginAttempts_nonnegative_check"
        CHECK ("failedLoginAttempts" >= 0),
    CONSTRAINT "Account_status_password_check"
        CHECK (
            ("status" = 'INVITED' AND "passwordHash" IS NULL)
            OR ("status" IN ('ACTIVE', 'LOCKED') AND "passwordHash" IS NOT NULL)
            OR "status" = 'DISABLED'
        ),
    CONSTRAINT "Account_lockedUntil_status_check"
        CHECK (
            ("status" = 'LOCKED' AND "lockedUntil" IS NOT NULL)
            OR ("status" <> 'LOCKED' AND "lockedUntil" IS NULL)
        )
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByActorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Invitation_tokenHash_format_check"
        CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "Invitation_terminal_state_check"
        CHECK (NOT ("acceptedAt" IS NOT NULL AND "revokedAt" IS NOT NULL)),
    CONSTRAINT "Invitation_expiresAt_check"
        CHECK ("expiresAt" > "createdAt"),
    CONSTRAINT "Invitation_acceptedAt_check"
        CHECK (
            "acceptedAt" IS NULL
            OR ("acceptedAt" >= "createdAt" AND "acceptedAt" < "expiresAt")
        ),
    CONSTRAINT "Invitation_revokedAt_check"
        CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt")
);

-- CreateTable
CREATE TABLE "AccountSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountSession_tokenHash_format_check"
        CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "AccountSession_expiresAt_check"
        CHECK ("expiresAt" > "createdAt"),
    CONSTRAINT "AccountSession_revokedAt_check"
        CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_clientId_key" ON "Account"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_accountId_createdAt_idx" ON "Invitation"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "Invitation_accountId_expiresAt_pending_idx"
ON "Invitation"("accountId", "expiresAt")
WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AccountSession_tokenHash_key" ON "AccountSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountSession_accountId_expiresAt_idx" ON "AccountSession"("accountId", "expiresAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSession" ADD CONSTRAINT "AccountSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
