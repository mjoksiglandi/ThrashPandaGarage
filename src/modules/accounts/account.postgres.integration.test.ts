import { createHash } from "node:crypto";
import { AccountStatus, Prisma, PrismaClient } from "@prisma/client";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";

const runId = `slice1_${Date.now()}`;
let sequence = 0;
const connectionA = new PrismaClient();
const connectionB = new PrismaClient();

function tokenHash(label: string) {
  return createHash("sha256").update(`${runId}_${label}`).digest("hex");
}

async function createClient(label: string) {
  sequence += 1;
  return db.client.create({
    data: {
      name: `${runId}_${sequence}_${label}`,
      email: `${runId}_${sequence}@example.test`,
    },
  });
}

async function createInvitedAccount(label: string) {
  const client = await createClient(label);
  const account = await db.account.create({
    data: {
      clientId: client.id,
      email: `${runId}_${sequence}_${label}@example.test`.toLowerCase(),
    },
  });
  return { client, account };
}

afterEach(async () => {
  await db.client.deleteMany({
    where: { name: { startsWith: runId } },
  });
});

afterAll(async () => {
  await Promise.all([
    connectionA.$disconnect(),
    connectionB.$disconnect(),
    db.$disconnect(),
  ]);
});

describe("Slice 1 account migration with PostgreSQL", () => {
  it("has exactly the three expected successful migrations", async () => {
    const migrations = await db.$queryRaw<
      Array<{
        migration_name: string;
        finished_at: Date | null;
        rolled_back_at: Date | null;
      }>
    >(Prisma.sql`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY started_at
    `);

    expect(migrations.map(({ migration_name }) => migration_name)).toEqual([
      "20260720233000_add_client_password",
      "20260723120000_harden_gallery_workflow",
      "20260725235807_add_account_invitation_sessions",
    ]);
    expect(migrations.every(({ finished_at }) => finished_at !== null)).toBe(true);
    expect(migrations.every(({ rolled_back_at }) => rolled_back_at === null)).toBe(true);
  });

  it("does not create an account when a client exists", async () => {
    const client = await createClient("no_backfill");

    expect(await db.client.findUnique({ where: { id: client.id } })).not.toBeNull();
    expect(await db.account.count({ where: { clientId: client.id } })).toBe(0);
  });

  it("persists account defaults", async () => {
    const { client, account } = await createInvitedAccount("defaults");

    expect(account).toMatchObject({
      clientId: client.id,
      status: AccountStatus.INVITED,
      failedLoginAttempts: 0,
      passwordHash: null,
      lockedUntil: null,
      lastLoginAt: null,
    });
  });

  it("enforces the Account to Client foreign key", async () => {
    await expect(
      db.account.create({
        data: {
          clientId: `${runId}_missing`,
          email: `${runId}_missing@example.test`,
        },
      })
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("allows only one account per client under concurrent connections", async () => {
    const client = await createClient("client_unique");

    const results = await Promise.allSettled([
      connectionA.account.create({
        data: {
          clientId: client.id,
          email: `${runId}_client_a@example.test`,
        },
      }),
      connectionB.account.create({
        data: {
          clientId: client.id,
          email: `${runId}_client_b@example.test`,
        },
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "P2002" },
    });
    expect(await db.account.count({ where: { clientId: client.id } })).toBe(1);
  });

  it("rejects equivalent emails concurrently through independent connections", async () => {
    const [clientA, clientB] = await Promise.all([
      createClient("email_unique_a"),
      createClient("email_unique_b"),
    ]);
    const canonicalEmail = `${runId}_shared@example.test`;
    const mixedCaseEmail = `${runId}_SHARED@EXAMPLE.TEST`;
    const now = new Date();

    const results = await Promise.allSettled([
      connectionA.$executeRaw(Prisma.sql`
        INSERT INTO "Account" (
          "id", "clientId", "email", "status", "failedLoginAttempts", "createdAt", "updatedAt"
        ) VALUES (
          ${`${runId}_email_a`}, ${clientA.id}, ${canonicalEmail},
          'INVITED'::"AccountStatus", 0, ${now}, ${now}
        )
      `),
      connectionB.$executeRaw(Prisma.sql`
        INSERT INTO "Account" (
          "id", "clientId", "email", "status", "failedLoginAttempts", "createdAt", "updatedAt"
        ) VALUES (
          ${`${runId}_email_b`}, ${clientB.id}, ${mixedCaseEmail},
          'INVITED'::"AccountStatus", 0, ${now}, ${now}
        )
      `),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const equivalentRows = await db.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM "Account"
      WHERE lower(btrim("email")) = ${canonicalEmail}
    `);
    expect(equivalentRows[0].count).toBe(1);
  });

  it("requires non-empty lower(trim(email)) at the database boundary", async () => {
    const { account } = await createInvitedAccount("canonical_email");
    const [spacesClient, caseClient, blankClient] = await Promise.all([
      createClient("email_spaces"),
      createClient("email_case"),
      createClient("email_blank"),
    ]);

    await expect(
      db.account.create({
        data: {
          clientId: spacesClient.id,
          email: `  ${account.email}  `,
        },
      })
    ).rejects.toBeDefined();
    await expect(
      db.account.create({
        data: {
          clientId: caseClient.id,
          email: account.email.toUpperCase(),
        },
      })
    ).rejects.toBeDefined();
    await expect(
      db.account.create({
        data: {
          clientId: blankClient.id,
          email: "",
        },
      })
    ).rejects.toBeDefined();

    const equivalentRows = await db.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM "Account"
      WHERE lower(btrim("email")) = ${account.email}
    `);
    expect(equivalentRows[0].count).toBe(1);
  });

  it("enforces account counter, password, status, and lock invariants", async () => {
    const client = await createClient("account_checks");
    const email = `${runId}_account_checks@example.test`;

    await expect(
      db.account.create({
        data: { clientId: client.id, email, failedLoginAttempts: -1 },
      })
    ).rejects.toBeDefined();
    await expect(
      db.account.create({
        data: { clientId: client.id, email, passwordHash: "hash" },
      })
    ).rejects.toBeDefined();
    await expect(
      db.account.create({
        data: { clientId: client.id, email, status: AccountStatus.ACTIVE },
      })
    ).rejects.toBeDefined();
    await expect(
      db.account.create({
        data: {
          clientId: client.id,
          email,
          status: AccountStatus.LOCKED,
          passwordHash: "hash",
        },
      })
    ).rejects.toBeDefined();
    await expect(
      db.account.create({
        data: {
          clientId: client.id,
          email,
          status: AccountStatus.ACTIVE,
          passwordHash: "hash",
          lockedUntil: new Date(Date.now() + 60_000),
        },
      })
    ).rejects.toBeDefined();

    expect(await db.account.count({ where: { clientId: client.id } })).toBe(0);
  });

  it("rejects malformed invitation and session hashes", async () => {
    const { account } = await createInvitedAccount("invalid_hashes");
    const expiresAt = new Date(Date.now() + 60_000);

    await expect(
      db.invitation.create({
        data: {
          accountId: account.id,
          tokenHash: "plain-invitation-token",
          expiresAt,
          createdByActorId: "slice1-test-admin",
        },
      })
    ).rejects.toBeDefined();
    await expect(
      db.accountSession.create({
        data: {
          accountId: account.id,
          tokenHash: "A".repeat(64),
          expiresAt,
        },
      })
    ).rejects.toBeDefined();

    expect(await db.invitation.count({ where: { accountId: account.id } })).toBe(0);
    expect(await db.accountSession.count({ where: { accountId: account.id } })).toBe(0);
  });

  it("enforces invitation and session hash uniqueness while retaining history", async () => {
    const { account } = await createInvitedAccount("tokens");
    const expiresAt = new Date(Date.now() + 60_000);
    const invitationHash = tokenHash("invitation");
    const sessionHash = tokenHash("session");
    const historicalCreatedAt = new Date(Date.now() - 1_000);
    const historicalRevokedAt = new Date();

    await db.invitation.createMany({
      data: [
        {
          accountId: account.id,
          tokenHash: invitationHash,
          expiresAt,
          createdByActorId: "slice1-test-admin",
        },
        {
          accountId: account.id,
          tokenHash: tokenHash("historical_invitation"),
          expiresAt,
          revokedAt: historicalRevokedAt,
          createdAt: historicalCreatedAt,
          createdByActorId: "slice1-test-admin",
        },
      ],
    });
    await expect(
      db.invitation.create({
        data: {
          accountId: account.id,
          tokenHash: invitationHash,
          expiresAt,
          createdByActorId: "slice1-test-admin",
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });

    await db.accountSession.createMany({
      data: [
        { accountId: account.id, tokenHash: sessionHash, expiresAt },
        {
          accountId: account.id,
          tokenHash: tokenHash("historical_session"),
          expiresAt,
          revokedAt: historicalRevokedAt,
          createdAt: historicalCreatedAt,
        },
      ],
    });
    await expect(
      db.accountSession.create({
        data: { accountId: account.id, tokenHash: sessionHash, expiresAt },
      })
    ).rejects.toMatchObject({ code: "P2002" });

    expect(await db.invitation.count({ where: { accountId: account.id } })).toBe(2);
    expect(await db.accountSession.count({ where: { accountId: account.id } })).toBe(2);
  });

  it("enforces invitation terminal state and temporal coherence", async () => {
    const { account } = await createInvitedAccount("invitation_dates");
    const now = new Date();
    const future = new Date(now.getTime() + 60_000);
    const past = new Date(now.getTime() - 60_000);

    await expect(
      db.invitation.create({
        data: {
          accountId: account.id,
          tokenHash: tokenHash("accepted_and_revoked"),
          expiresAt: future,
          acceptedAt: now,
          revokedAt: now,
          createdByActorId: "slice1-test-admin",
        },
      })
    ).rejects.toBeDefined();
    await expect(
      db.invitation.create({
        data: {
          accountId: account.id,
          tokenHash: tokenHash("expired_at_creation"),
          expiresAt: past,
          createdByActorId: "slice1-test-admin",
        },
      })
    ).rejects.toBeDefined();
    await expect(
      db.invitation.create({
        data: {
          accountId: account.id,
          tokenHash: tokenHash("accepted_after_expiry"),
          expiresAt: future,
          acceptedAt: new Date(future.getTime() + 1),
          createdByActorId: "slice1-test-admin",
        },
      })
    ).rejects.toBeDefined();
    await expect(
      db.invitation.create({
        data: {
          accountId: account.id,
          tokenHash: tokenHash("revoked_before_creation"),
          expiresAt: future,
          revokedAt: past,
          createdByActorId: "slice1-test-admin",
        },
      })
    ).rejects.toBeDefined();
  });

  it("enforces session temporal coherence", async () => {
    const { account } = await createInvitedAccount("session_dates");
    const now = new Date();
    const future = new Date(now.getTime() + 60_000);
    const past = new Date(now.getTime() - 60_000);

    await expect(
      db.accountSession.create({
        data: {
          accountId: account.id,
          tokenHash: tokenHash("expired_session"),
          expiresAt: past,
        },
      })
    ).rejects.toBeDefined();
    await expect(
      db.accountSession.create({
        data: {
          accountId: account.id,
          tokenHash: tokenHash("revoked_before_session"),
          expiresAt: future,
          revokedAt: past,
        },
      })
    ).rejects.toBeDefined();
  });

  it("rolls back the full transaction after a constraint violation", async () => {
    const { account } = await createInvitedAccount("rollback");
    const retainedHash = tokenHash("must_rollback");

    await expect(
      db.$transaction(async (tx) => {
        await tx.invitation.create({
          data: {
            accountId: account.id,
            tokenHash: retainedHash,
            expiresAt: new Date(Date.now() + 60_000),
            createdByActorId: "slice1-test-admin",
          },
        });
        await tx.invitation.create({
          data: {
            accountId: account.id,
            tokenHash: "not-a-hash",
            expiresAt: new Date(Date.now() + 60_000),
            createdByActorId: "slice1-test-admin",
          },
        });
      })
    ).rejects.toBeDefined();

    expect(await db.invitation.count({ where: { tokenHash: retainedHash } })).toBe(0);
  });

  it("cascades a deleted client through account, invitations, and sessions", async () => {
    const client = await createClient("cascade");
    const account = await db.account.create({
      data: {
        clientId: client.id,
        email: `${runId}_cascade@example.test`,
        invitations: {
          create: {
            tokenHash: tokenHash("cascade_invitation"),
            expiresAt: new Date(Date.now() + 60_000),
            createdByActorId: "slice1-test-admin",
          },
        },
        sessions: {
          create: {
            tokenHash: tokenHash("cascade_session"),
            expiresAt: new Date(Date.now() + 60_000),
          },
        },
      },
    });

    await db.client.delete({ where: { id: client.id } });

    expect(await db.account.count({ where: { id: account.id } })).toBe(0);
    expect(await db.invitation.count({ where: { accountId: account.id } })).toBe(0);
    expect(await db.accountSession.count({ where: { accountId: account.id } })).toBe(0);
  });

  it("materializes the expected indexes, checks, and cascade constraints", async () => {
    const indexes = await db.$queryRaw<Array<{ indexname: string }>>(Prisma.sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('Account', 'Invitation', 'AccountSession')
    `);
    expect(indexes.map(({ indexname }) => indexname)).toEqual(
      expect.arrayContaining([
        "Account_clientId_key",
        "Account_email_key",
        "Invitation_tokenHash_key",
        "Invitation_accountId_createdAt_idx",
        "Invitation_accountId_expiresAt_pending_idx",
        "AccountSession_tokenHash_key",
        "AccountSession_accountId_expiresAt_idx",
      ])
    );

    const checks = await db.$queryRaw<Array<{ conname: string }>>(Prisma.sql`
      SELECT conname
      FROM pg_constraint
      WHERE contype = 'c'
        AND conrelid IN (
          '"Account"'::regclass,
          '"Invitation"'::regclass,
          '"AccountSession"'::regclass
        )
    `);
    expect(checks.map(({ conname }) => conname)).toEqual(
      expect.arrayContaining([
        "Account_email_canonical_check",
        "Account_failedLoginAttempts_nonnegative_check",
        "Account_status_password_check",
        "Account_lockedUntil_status_check",
        "Invitation_tokenHash_format_check",
        "Invitation_terminal_state_check",
        "Invitation_expiresAt_check",
        "Invitation_acceptedAt_check",
        "Invitation_revokedAt_check",
        "AccountSession_tokenHash_format_check",
        "AccountSession_expiresAt_check",
        "AccountSession_revokedAt_check",
      ])
    );

    const foreignKeys = await db.$queryRaw<
      Array<{ constraint_name: string; update_rule: string; delete_rule: string }>
    >(Prisma.sql`
      SELECT
        tc.constraint_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_schema = tc.constraint_schema
       AND rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_schema = 'public'
        AND tc.table_name IN ('Account', 'Invitation', 'AccountSession')
        AND tc.constraint_type = 'FOREIGN KEY'
    `);

    expect(foreignKeys).toHaveLength(3);
    expect(foreignKeys).toEqual(
      expect.arrayContaining([
        {
          constraint_name: "Account_clientId_fkey",
          update_rule: "CASCADE",
          delete_rule: "CASCADE",
        },
        {
          constraint_name: "Invitation_accountId_fkey",
          update_rule: "CASCADE",
          delete_rule: "CASCADE",
        },
        {
          constraint_name: "AccountSession_accountId_fkey",
          update_rule: "CASCADE",
          delete_rule: "CASCADE",
        },
      ])
    );
  });
});
