import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  createPrismaAccountServiceStore,
  type AccountServiceStore,
  type AccountServiceTransaction,
} from "./account-service.repository";
import {
  ACCEPTANCE_PASSWORD_MAX_LENGTH,
  createInvitationService,
} from "@/modules/invitations/invitation.service";
import { createAccountSessionService } from "@/modules/account-sessions/account-session.service";
import { createAuthenticationAttemptService } from "./authentication-attempt.service";
import {
  InvitationAccountStatusError,
  InvalidPasswordHashError,
  InvitationAlreadyAcceptedError,
  InvitationRevokedError,
  PasswordHashingError,
} from "@/modules/invitations/invitation.errors";
import {
  AccountSessionExpiredError,
  AccountSessionRevokedError,
} from "@/modules/account-sessions/account-session.errors";
import {
  AccountInvitationNotAllowedError,
  AccountLockedError,
  InvalidCredentialsError,
} from "./account.errors";
import { sha256TokenHasher } from "./secure-token";

const runId = `account_services_${Date.now()}`;
let sequence = 0;
const connectionA = new PrismaClient();
const connectionB = new PrismaClient();
const primaryStore = createPrismaAccountServiceStore();
const storeA = createPrismaAccountServiceStore(connectionA);
const storeB = createPrismaAccountServiceStore(connectionB);

class FixedClock {
  constructor(public value: Date) {}

  now() {
    return new Date(this.value);
  }
}

function deterministicTokens(...tokens: string[]) {
  let index = 0;
  return {
    generate() {
      const label = tokens[index];
      index += 1;
      if (!label) {
        throw new Error("Test token generator exhausted");
      }
      return canonicalTestToken(label);
    },
  };
}

function canonicalTestToken(label: string) {
  return Buffer.from(label).toString("base64url").padEnd(43, "_");
}

const passwordHasher = {
  async hash(password: string) {
    return `fake-hash:${password}`;
  },
  async verify(password: string, passwordHash: string) {
    return passwordHash === `fake-hash:${password}`;
  },
};

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
      email: `${runId}_${sequence}_${label}@example.test`,
    },
  });
  return { client, account };
}

async function createActiveAccount(label: string) {
  const client = await createClient(label);
  const account = await db.account.create({
    data: {
      clientId: client.id,
      email: `${runId}_${sequence}_${label}@example.test`,
      status: "ACTIVE",
      passwordHash: "existing-fake-hash",
    },
  });
  return { client, account };
}

function invitationService(
  store: AccountServiceStore,
  clock: FixedClock,
  ...tokens: string[]
) {
  return createInvitationService({
    store,
    clock,
    tokenGenerator: deterministicTokens(...tokens),
    tokenHasher: sha256TokenHasher,
    passwordHasher,
    invitationDurationMs: 60_000,
  });
}

function sessionService(
  store: AccountServiceStore,
  clock: FixedClock,
  ...tokens: string[]
) {
  return createAccountSessionService({
    store,
    clock,
    tokenGenerator: deterministicTokens(...tokens),
    tokenHasher: sha256TokenHasher,
    sessionDurationMs: 60_000,
  });
}

function failDuringInvitationAcceptance(
  baseStore: AccountServiceStore
): AccountServiceStore {
  return {
    findAuthenticationAccountByEmail(email) {
      return baseStore.findAuthenticationAccountByEmail(email);
    },
    transaction(work) {
      return baseStore.transaction((transaction) => {
        const failingTransaction = new Proxy(transaction, {
          get(target, property, receiver) {
            if (property === "acceptInvitation") {
              return async () => {
                throw new Error("Injected intermediate update failure");
              };
            }
            const value = Reflect.get(target, property, receiver);
            return typeof value === "function" ? value.bind(target) : value;
          },
        }) as AccountServiceTransaction;
        return work(failingTransaction);
      });
    },
  };
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

describe("transactional invitation services with PostgreSQL", () => {
  it("revokes every previous pending invitation and stores only a digest", async () => {
    const { account } = await createInvitedAccount("issue");
    const clock = new FixedClock(new Date("2026-07-25T12:00:00.000Z"));
    const service = invitationService(
      primaryStore,
      clock,
      "first-invitation-token",
      "second-invitation-token"
    );

    const first = await service.issue({
      accountId: account.id,
      createdByActorId: "admin-1",
    });
    clock.value = new Date("2026-07-25T12:00:01.000Z");
    const second = await service.issue({
      email: account.email.toUpperCase(),
      createdByActorId: "admin-2",
    });

    const invitations = await db.invitation.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "asc" },
    });
    expect(invitations).toHaveLength(2);
    expect(invitations[0].revokedAt).toEqual(clock.value);
    expect(invitations[1].revokedAt).toBeNull();
    expect(invitations[0].tokenHash).toBe(
      sha256TokenHasher.digest(first.token)
    );
    expect(invitations[1].tokenHash).toBe(
      sha256TokenHasher.digest(second.token)
    );
    expect(invitations.map((invitation) => invitation.tokenHash)).not.toContain(
      first.token
    );
    expect(first).not.toHaveProperty("tokenHash");
    expect(second).not.toHaveProperty("tokenHash");
  });

  it("serializes concurrent issuance through independent connections", async () => {
    const { account } = await createInvitedAccount("issue_race");
    const clock = new FixedClock(new Date("2026-07-25T13:00:00.000Z"));
    const serviceA = invitationService(storeA, clock, "race-token-a");
    const serviceB = invitationService(storeB, clock, "race-token-b");

    await Promise.all([
      serviceA.issue({
        accountId: account.id,
        createdByActorId: "admin-a",
      }),
      serviceB.issue({
        accountId: account.id,
        createdByActorId: "admin-b",
      }),
    ]);

    expect(
      await db.invitation.count({
        where: {
          accountId: account.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: clock.value },
        },
      })
    ).toBe(1);
    expect(await db.invitation.count({ where: { accountId: account.id } })).toBe(
      2
    );
  });

  it("accepts once, activates the account, and revokes other pending invitations", async () => {
    const { account } = await createInvitedAccount("accept");
    const clock = new FixedClock(new Date("2026-07-25T14:00:00.000Z"));
    const service = invitationService(
      primaryStore,
      clock,
      "accepted-token",
      "replacement-token"
    );
    const issued = await service.issue({
      accountId: account.id,
      createdByActorId: "admin",
    });
    const otherPending = await db.invitation.create({
      data: {
        accountId: account.id,
        tokenHash: sha256TokenHasher.digest(
          canonicalTestToken("other-pending-token")
        ),
        expiresAt: new Date(clock.value.getTime() + 60_000),
        createdAt: clock.value,
        createdByActorId: "fixture-admin",
      },
    });

    const result = await service.accept({
      token: issued.token,
      password: "new-password",
    });

    expect(result).toMatchObject({
      accountId: account.id,
      status: "ACTIVE",
    });
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("tokenHash");
    expect(
      await db.account.findUniqueOrThrow({ where: { id: account.id } })
    ).toMatchObject({
      status: "ACTIVE",
      passwordHash: "fake-hash:new-password",
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    expect(
      await db.invitation.findUniqueOrThrow({
        where: { id: issued.invitationId },
      })
    ).toMatchObject({ acceptedAt: clock.value, revokedAt: null });
    expect(
      await db.invitation.findUniqueOrThrow({ where: { id: otherPending.id } })
    ).toMatchObject({ acceptedAt: null, revokedAt: clock.value });
  });

  it("allows exactly one concurrent acceptance of the same token", async () => {
    const { account } = await createInvitedAccount("accept_race");
    const clock = new FixedClock(new Date("2026-07-25T15:00:00.000Z"));
    const issuer = invitationService(primaryStore, clock, "shared-token");
    const issued = await issuer.issue({
      accountId: account.id,
      createdByActorId: "admin",
    });
    const serviceA = invitationService(storeA, clock, "unused-a");
    const serviceB = invitationService(storeB, clock, "unused-b");

    const results = await Promise.allSettled([
      serviceA.accept({ token: issued.token, password: "password-a-secure" }),
      serviceB.accept({ token: issued.token, password: "password-b-secure" }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
      1
    );
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: expect.any(InvitationAlreadyAcceptedError),
    });
    expect(
      await db.invitation.count({
        where: { id: issued.invitationId, acceptedAt: { not: null } },
      })
    ).toBe(1);
    const activatedAccount = await db.account.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(activatedAccount).toMatchObject({ status: "ACTIVE" });
    expect([
      "fake-hash:password-a-secure",
      "fake-hash:password-b-secure",
    ]).toContain(activatedAccount.passwordHash);
  });

  it("serializes invitation acceptance against issuance over 12 races", async () => {
    const clock = new FixedClock(new Date("2026-07-25T15:15:00.000Z"));

    for (let iteration = 0; iteration < 12; iteration += 1) {
      clock.value = new Date(
        `2026-07-25T15:${String(15 + iteration).padStart(2, "0")}:00.000Z`
      );
      const { account } = await createInvitedAccount(
        `accept_issue_race_${iteration}`
      );
      const initial = invitationService(
        primaryStore,
        clock,
        `initial-race-token-${iteration}`
      );
      const issued = await initial.issue({
        accountId: account.id,
        createdByActorId: "admin-initial",
      });
      const accepter = invitationService(
        storeA,
        clock,
        `unused-race-token-${iteration}`
      );
      const issuer = invitationService(
        storeB,
        clock,
        `replacement-race-token-${iteration}`
      );

      const outcomes = await Promise.allSettled([
        accepter.accept({
          token: issued.token,
          password: `password-secure-${iteration}`,
        }),
        issuer.issue({
          accountId: account.id,
          createdByActorId: "admin-racing",
        }),
      ]);

      expect(
        outcomes.filter((outcome) => outcome.status === "fulfilled")
      ).toHaveLength(1);
      const rejected = outcomes.find(
        (outcome) => outcome.status === "rejected"
      ) as PromiseRejectedResult;
      expect(
        rejected.reason instanceof InvitationRevokedError ||
          rejected.reason instanceof AccountInvitationNotAllowedError
      ).toBe(true);
    }
  });

  it("does not overwrite the password of an already active account", async () => {
    const { account } = await createActiveAccount("active_acceptance_guard");
    const clock = new FixedClock(new Date("2026-07-25T15:30:00.000Z"));
    const token = canonicalTestToken("active-account-invitation");
    const invitation = await db.invitation.create({
      data: {
        accountId: account.id,
        tokenHash: sha256TokenHasher.digest(token),
        expiresAt: new Date(clock.value.getTime() + 60_000),
        createdAt: clock.value,
        createdByActorId: "fixture-admin",
      },
    });
    const service = invitationService(primaryStore, clock, "unused");

    await expect(
      service.accept({ token, password: "replacement-password" })
    ).rejects.toBeInstanceOf(InvitationAccountStatusError);
    expect(
      await db.account.findUniqueOrThrow({ where: { id: account.id } })
    ).toMatchObject({
      status: "ACTIVE",
      passwordHash: "existing-fake-hash",
    });
    expect(
      await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } })
    ).toMatchObject({ acceptedAt: null, revokedAt: null });
  });

  it("rolls back account activation when a later update fails", async () => {
    const { account } = await createInvitedAccount("rollback");
    const clock = new FixedClock(new Date("2026-07-25T16:00:00.000Z"));
    const issuer = invitationService(primaryStore, clock, "rollback-token");
    const issued = await issuer.issue({
      accountId: account.id,
      createdByActorId: "admin",
    });
    const failingService = invitationService(
      failDuringInvitationAcceptance(primaryStore),
      clock,
      "unused"
    );

    await expect(
      failingService.accept({
        token: issued.token,
        password: "must-rollback",
      })
    ).rejects.toThrow("Injected intermediate update failure");

    expect(
      await db.account.findUniqueOrThrow({ where: { id: account.id } })
    ).toMatchObject({
      status: "INVITED",
      passwordHash: null,
      failedLoginAttempts: 0,
    });
    expect(
      await db.invitation.findUniqueOrThrow({
        where: { id: issued.invitationId },
      })
    ).toMatchObject({ acceptedAt: null, revokedAt: null });
  });

  it("leaves persistence untouched when the password hasher fails", async () => {
    const { account } = await createInvitedAccount("hasher_rollback");
    const clock = new FixedClock(new Date("2026-07-25T16:30:00.000Z"));
    const issuer = invitationService(primaryStore, clock, "hasher-token");
    const issued = await issuer.issue({
      accountId: account.id,
      createdByActorId: "admin",
    });
    const service = createInvitationService({
      store: primaryStore,
      clock,
      tokenGenerator: deterministicTokens("unused"),
      tokenHasher: sha256TokenHasher,
      passwordHasher: {
        async hash() {
          throw new Error("Hasher unavailable");
        },
        async verify() {
          return false;
        },
      },
      invitationDurationMs: 60_000,
    });

    await expect(
      service.accept({ token: issued.token, password: "password-secure" })
    ).rejects.toBeInstanceOf(PasswordHashingError);
    expect(
      await db.account.findUniqueOrThrow({ where: { id: account.id } })
    ).toMatchObject({ status: "INVITED", passwordHash: null });
    expect(
      await db.invitation.findUniqueOrThrow({
        where: { id: issued.invitationId },
      })
    ).toMatchObject({ acceptedAt: null, revokedAt: null });
  });

  it.each([
    {
      label: "whitespace_password",
      password: "   ",
      hash: "unused-valid-hash",
      error: InvalidCredentialsError,
    },
    {
      label: "oversized_password",
      password: "p".repeat(ACCEPTANCE_PASSWORD_MAX_LENGTH + 1),
      hash: "unused-valid-hash",
      error: InvalidCredentialsError,
    },
    {
      label: "empty_password_hash",
      password: "valid-password",
      hash: "",
      error: InvalidPasswordHashError,
    },
  ])(
    "leaves persistence unchanged after $label",
    async ({ label, password, hash, error }) => {
      const { account } = await createInvitedAccount(label);
      const clock = new FixedClock(new Date("2026-07-25T16:45:00.000Z"));
      const issuer = invitationService(
        primaryStore,
        clock,
        `issuer_${label}`
      );
      const issued = await issuer.issue({
        accountId: account.id,
        createdByActorId: "admin",
      });
      const service = createInvitationService({
        store: primaryStore,
        clock,
        tokenGenerator: deterministicTokens("unused"),
        tokenHasher: sha256TokenHasher,
        passwordHasher: {
          async hash() {
            return hash;
          },
          async verify() {
            return false;
          },
        },
        invitationDurationMs: 60_000,
      });

      await expect(
        service.accept({ token: issued.token, password })
      ).rejects.toBeInstanceOf(error);
      expect(
        await db.account.findUniqueOrThrow({ where: { id: account.id } })
      ).toMatchObject({
        status: "INVITED",
        passwordHash: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      expect(
        await db.invitation.findUniqueOrThrow({
          where: { id: issued.invitationId },
        })
      ).toMatchObject({ acceptedAt: null, revokedAt: null });
    }
  );
});

describe("transactional account sessions with PostgreSQL", () => {
  it("creates and validates a session without returning or storing a plain token", async () => {
    const { account } = await createActiveAccount("session");
    const clock = new FixedClock(new Date("2026-07-25T17:00:00.000Z"));
    const service = sessionService(primaryStore, clock, "session-token");

    const created = await service.create(account.id);
    const validated = await service.validate(created.token);
    const persisted = await db.accountSession.findUniqueOrThrow({
      where: { id: created.sessionId },
    });

    expect(validated).toEqual({
      sessionId: created.sessionId,
      accountId: account.id,
      clientId: account.clientId,
      email: account.email,
      expiresAt: created.expiresAt,
    });
    expect(created).not.toHaveProperty("tokenHash");
    expect(validated).not.toHaveProperty("tokenHash");
    expect(persisted.tokenHash).toBe(
      sha256TokenHasher.digest(created.token)
    );
    expect(persisted.tokenHash).not.toBe(created.token);
  });

  it("rejects expiry at the exact boundary and rejects revoked sessions", async () => {
    const { account } = await createActiveAccount("session_expiry");
    const clock = new FixedClock(new Date("2026-07-25T18:00:00.000Z"));
    const service = sessionService(
      primaryStore,
      clock,
      "expiring-session",
      "revoked-session"
    );

    const expiring = await service.create(account.id);
    clock.value = expiring.expiresAt;
    await expect(service.validate(expiring.token)).rejects.toBeInstanceOf(
      AccountSessionExpiredError
    );

    clock.value = new Date("2026-07-25T18:00:01.000Z");
    const revoked = await service.create(account.id);
    await service.revoke(revoked.token);
    await expect(service.validate(revoked.token)).rejects.toBeInstanceOf(
      AccountSessionRevokedError
    );
  });

  it("revokes one session idempotently and all account sessions", async () => {
    const { account } = await createActiveAccount("session_revoke");
    const clock = new FixedClock(new Date("2026-07-25T19:00:00.000Z"));
    const service = sessionService(
      primaryStore,
      clock,
      "session-one",
      "session-two",
      "session-three"
    );
    const first = await service.create(account.id);
    await service.create(account.id);
    await service.create(account.id);

    const firstRevocation = await service.revoke(first.token);
    clock.value = new Date("2026-07-25T19:00:01.000Z");
    const repeatedRevocation = await service.revoke(first.token);
    expect(repeatedRevocation.revokedAt).toEqual(firstRevocation.revokedAt);

    const all = await service.revokeAll(account.id);
    expect(all.revokedCount).toBe(2);
    clock.value = new Date("2026-07-25T19:00:02.000Z");
    const repeatedAll = await service.revokeAll(account.id);
    expect(repeatedAll.revokedCount).toBe(0);
    expect(
      await db.accountSession.count({
        where: { accountId: account.id, revokedAt: null },
      })
    ).toBe(0);
  });

  it("revalidates the same unrevoked session after a locked account becomes ACTIVE again", async () => {
    const { account } = await createActiveAccount("session_locked");
    const clock = new FixedClock(new Date("2026-07-25T20:00:00.000Z"));
    const sessions = sessionService(primaryStore, clock, "locked-session");
    const authentication = createAuthenticationAttemptService({
      store: primaryStore,
      clock,
      lockPolicy: { failedAttemptThreshold: 1, lockDurationMs: 30_000 },
    });
    const created = await sessions.create(account.id);
    const locked = await authentication.recordFailedAttempt({
      accountId: account.id,
    });

    expect(locked).toMatchObject({
      status: "LOCKED",
      lockedUntil: new Date("2026-07-25T20:00:30.000Z"),
    });
    await expect(sessions.validate(created.token)).rejects.toBeInstanceOf(
      AccountLockedError
    );
    expect(
      await db.accountSession.findUniqueOrThrow({
        where: { id: created.sessionId },
      })
    ).toMatchObject({ revokedAt: null });

    clock.value = new Date("2026-07-25T20:00:30.000Z");
    await expect(
      authentication.recordSuccessfulAuthentication({
        accountId: account.id,
      })
    ).resolves.toMatchObject({
      status: "ACTIVE",
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    await expect(sessions.validate(created.token)).resolves.toEqual({
      sessionId: created.sessionId,
      accountId: account.id,
      clientId: account.clientId,
      email: account.email,
      expiresAt: created.expiresAt,
    });
  });
});

describe("authentication attempt serialization with PostgreSQL", () => {
  it("does not lose concurrent increments across independent connections", async () => {
    const { account } = await createActiveAccount("attempt_race");
    const clock = new FixedClock(new Date("2026-07-25T21:00:00.000Z"));
    const serviceA = createAuthenticationAttemptService({
      store: storeA,
      clock,
      lockPolicy: { failedAttemptThreshold: 10, lockDurationMs: 60_000 },
    });
    const serviceB = createAuthenticationAttemptService({
      store: storeB,
      clock,
      lockPolicy: { failedAttemptThreshold: 10, lockDurationMs: 60_000 },
    });

    await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        (index % 2 === 0 ? serviceA : serviceB).recordFailedAttempt({
          accountId: account.id,
        })
      )
    );

    expect(
      await db.account.findUniqueOrThrow({ where: { id: account.id } })
    ).toMatchObject({
      status: "ACTIVE",
      failedLoginAttempts: 6,
      lockedUntil: null,
    });
  });

  it("locks at the threshold and resets after the exact unlock boundary", async () => {
    const { account } = await createActiveAccount("attempt_lock");
    const clock = new FixedClock(new Date("2026-07-25T22:00:00.000Z"));
    const service = createAuthenticationAttemptService({
      store: primaryStore,
      clock,
      lockPolicy: { failedAttemptThreshold: 2, lockDurationMs: 60_000 },
    });

    await service.recordFailedAttempt({ accountId: account.id });
    const locked = await service.recordFailedAttempt({ accountId: account.id });
    expect(locked).toMatchObject({
      status: "LOCKED",
      failedLoginAttempts: 2,
      lockedUntil: new Date("2026-07-25T22:01:00.000Z"),
    });
    await expect(
      service.recordSuccessfulAuthentication({ accountId: account.id })
    ).rejects.toBeInstanceOf(AccountLockedError);

    clock.value = new Date("2026-07-25T22:01:00.000Z");
    const reset = await service.recordSuccessfulAuthentication({
      accountId: account.id,
    });
    expect(reset).toMatchObject({
      status: "ACTIVE",
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: clock.value,
    });

    clock.value = new Date("2026-07-25T22:01:01.000Z");
    const repeatedReset = await service.recordSuccessfulAuthentication({
      accountId: account.id,
    });
    expect(repeatedReset).toMatchObject({
      status: "ACTIVE",
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: clock.value,
    });
    expect(
      await db.account.findUniqueOrThrow({ where: { id: account.id } })
    ).toMatchObject({
      status: repeatedReset.status,
      failedLoginAttempts: repeatedReset.failedLoginAttempts,
      lockedUntil: repeatedReset.lockedUntil,
      lastLoginAt: repeatedReset.lastLoginAt,
    });
  });

  it("preserves cascades for service-created invitations and sessions in fixtures", async () => {
    const { client, account } = await createInvitedAccount("cascade");
    const clock = new FixedClock(new Date("2026-07-25T23:00:00.000Z"));
    const invitation = invitationService(
      primaryStore,
      clock,
      "cascade-invitation"
    );
    const issued = await invitation.issue({
      accountId: account.id,
      createdByActorId: "admin",
    });
    await invitation.accept({
      token: issued.token,
      password: "cascade-password",
    });
    const sessions = sessionService(
      primaryStore,
      clock,
      "cascade-session"
    );
    await sessions.create(account.id);

    await db.client.delete({ where: { id: client.id } });

    expect(await db.account.count({ where: { id: account.id } })).toBe(0);
    expect(
      await db.invitation.count({ where: { accountId: account.id } })
    ).toBe(0);
    expect(
      await db.accountSession.count({ where: { accountId: account.id } })
    ).toBe(0);
  });
});
