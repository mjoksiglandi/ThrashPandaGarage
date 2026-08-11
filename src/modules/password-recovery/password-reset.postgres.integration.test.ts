import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  afterAll,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db } from "@/lib/db";
import { normalizeAccountEmail } from "@/modules/accounts/account-email";
import {
  createAccountLoginService,
} from "@/modules/accounts/account-login.service";
import {
  createPrismaAccountServiceStore,
} from "@/modules/accounts/account-service.repository";
import {
  createAuthenticationAttemptService,
} from "@/modules/accounts/authentication-attempt.service";
import { InvalidCredentialsError } from "@/modules/accounts/account.errors";
import { sha256TokenHasher } from "@/modules/accounts/secure-token";
import {
  ACCOUNT_SESSION_COOKIE_NAME,
  LEGACY_CLIENT_COOKIE_NAME,
} from "@/modules/account-sessions/account-session-cookie";
import {
  AccountSessionRevokedError,
} from "@/modules/account-sessions/account-session.errors";
import {
  createAccountSessionService,
} from "@/modules/account-sessions/account-session.service";
import {
  createCurrentAccountSessionService,
} from "@/modules/account-sessions/current-account-session.service";
import {
  createInvitationService,
} from "@/modules/invitations/invitation.service";
import {
  createPasswordRecoveryService,
} from "./password-recovery.service";
import {
  createPrismaPasswordRecoveryStore,
  createPrismaPasswordResetStore,
  type PasswordResetStore,
} from "./password-recovery.repository";
import {
  createPasswordResetService,
  PasswordResetUnavailableError,
} from "./password-reset.service";

const runId = `password_reset_${Date.now()}`;
let sequence = 0;
const connectionA = new PrismaClient();
const connectionB = new PrismaClient();
const connectionC = new PrismaClient();
const resetStore = createPrismaPasswordResetStore();
const resetStoreA = createPrismaPasswordResetStore(connectionA);
const resetStoreB = createPrismaPasswordResetStore(connectionB);
const accountStoreB = createPrismaAccountServiceStore(connectionB);
const accountStoreC = createPrismaAccountServiceStore(connectionC);

class FixedClock {
  constructor(public value: Date) {}

  now() {
    return new Date(this.value);
  }
}

function canonicalToken(label: string) {
  return Buffer.from(label).toString("base64url").padEnd(43, "_");
}

async function createAccount(label: string, passwordHash = "old-hash") {
  sequence += 1;
  const client = await db.client.create({
    data: {
      name: `${runId}_${sequence}_${label}`,
      email: `${runId}_${sequence}@example.test`,
    },
  });
  const account = await db.account.create({
    data: {
      clientId: client.id,
      email: `${runId}_${sequence}_${label}@example.test`,
      status: "ACTIVE",
      passwordHash,
    },
  });
  return { account, client };
}

async function createRecovery(
  accountId: string,
  token: string,
  now: Date,
  overrides: {
    expiresAt?: Date;
    consumedAt?: Date;
    revokedAt?: Date;
  } = {}
) {
  return db.accountPasswordRecovery.create({
    data: {
      accountId,
      tokenHash: sha256TokenHasher.digest(token),
      createdAt: now,
      expiresAt:
        overrides.expiresAt ?? new Date(now.getTime() + 60 * 60 * 1000),
      consumedAt: overrides.consumedAt,
      revokedAt: overrides.revokedAt,
    },
  });
}

async function createSession(
  accountId: string,
  token: string,
  now: Date,
  revokedAt?: Date
) {
  return db.accountSession.create({
    data: {
      accountId,
      tokenHash: sha256TokenHasher.digest(token),
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      revokedAt,
    },
  });
}

function resetService(
  store: PasswordResetStore,
  clock: FixedClock,
  hash: (password: string) => Promise<string> = async (password) =>
    `new-hash:${password}`
) {
  return createPasswordResetService({
    store,
    clock,
    tokenHasher: sha256TokenHasher,
    passwordHasher: { hash },
  });
}

afterEach(async () => {
  await db.client.deleteMany({
    where: { name: { startsWith: runId } },
  });
  expect(
    await db.accountPasswordRecovery.count({
      where: {
        account: {
          client: { name: { startsWith: runId } },
        },
      },
    })
  ).toBe(0);
  expect(
    await db.accountSession.count({
      where: {
        account: {
          client: { name: { startsWith: runId } },
        },
      },
    })
  ).toBe(0);
});

afterAll(async () => {
  await Promise.all([
    connectionA.$disconnect(),
    connectionB.$disconnect(),
    connectionC.$disconnect(),
    db.$disconnect(),
  ]);
});

describe("password reset with PostgreSQL", () => {
  it("completes invitation through reset and rejects old and legacy access", async () => {
    sequence += 1;
    const clock = new FixedClock(new Date("2026-07-27T11:00:00.000Z"));
    const client = await db.client.create({
      data: {
        name: `${runId}_${sequence}_lifecycle`,
        email: `${runId}_${sequence}@example.test`,
      },
    });
    const account = await db.account.create({
      data: {
        clientId: client.id,
        email: `${runId}_${sequence}_lifecycle@example.test`,
        status: "INVITED",
      },
    });
    const invitationToken = canonicalToken("lifecycle-invitation");
    const recoveryToken = canonicalToken("lifecycle-recovery");
    const sessionTokens = [
      canonicalToken("lifecycle-session-old"),
      canonicalToken("lifecycle-session-new"),
    ];
    const oldPassword = "old-password-secure";
    const newPassword = "new-password-secure";
    const accountStore = createPrismaAccountServiceStore(connectionA);
    const invitations = createInvitationService({
      store: accountStore,
      clock,
      tokenGenerator: { generate: () => invitationToken },
      tokenHasher: sha256TokenHasher,
      passwordHasher: {
        hash: (password) => bcrypt.hash(password, 12),
        verify: (password, passwordHash) =>
          bcrypt.compare(password, passwordHash),
      },
      invitationDurationMs: 60 * 60 * 1000,
    });

    const invitation = await invitations.issue({
      accountId: account.id,
      createdByActorId: "lifecycle-admin",
    });
    await invitations.accept({
      token: invitation.token,
      password: oldPassword,
    });

    const authenticationAttempts = createAuthenticationAttemptService({
      store: accountStore,
      clock,
      lockPolicy: {
        failedAttemptThreshold: 5,
        lockDurationMs: 15 * 60 * 1000,
      },
    });
    const accountSessions = createAccountSessionService({
      store: accountStore,
      clock,
      tokenGenerator: {
        generate: () => sessionTokens.shift() as string,
      },
      tokenHasher: sha256TokenHasher,
      sessionDurationMs: 60 * 60 * 1000,
    });
    const login = createAccountLoginService({
      store: accountStore,
      authenticationAttempts,
      accountSessions,
      passwordVerifier: {
        verify: (password, passwordHash) =>
          bcrypt.compare(password, passwordHash),
      },
      nonexistentAccountPasswordHash: "unused-sentinel",
    });
    const currentSessions = createCurrentAccountSessionService({
      accountSessions,
    });
    const oldSession = await login.authenticate({
      email: account.email,
      password: oldPassword,
    });
    await expect(
      currentSessions.resolve(oldSession.token)
    ).resolves.toMatchObject({
      kind: "authenticated",
      principal: {
        accountId: account.id,
        clientId: client.id,
      },
    });

    let deliveredRecoveryToken: string | null = null;
    const recovery = createPasswordRecoveryService({
      store: createPrismaPasswordRecoveryStore(connectionB),
      clock,
      tokenGenerator: { generate: () => recoveryToken },
      tokenHasher: sha256TokenHasher,
      durationMs: 60 * 60 * 1000,
      mailer: {
        async send(input) {
          deliveredRecoveryToken = input.token;
        },
      },
      logger: { deliveryFailed: vi.fn() },
    });
    await recovery.request(normalizeAccountEmail(account.email));
    expect(deliveredRecoveryToken).toBe(recoveryToken);

    await resetService(resetStoreB, clock, (password) =>
      bcrypt.hash(password, 12)
    ).reset({
      token: deliveredRecoveryToken,
      password: newPassword,
    });

    await expect(currentSessions.resolve(oldSession.token)).resolves.toEqual({
      kind: "unauthenticated",
    });
    const legacyOnlyCookies = new Map([
      [LEGACY_CLIENT_COOKIE_NAME, client.id],
    ]);
    expect(legacyOnlyCookies.has(LEGACY_CLIENT_COOKIE_NAME)).toBe(true);
    await expect(
      currentSessions.resolve(
        legacyOnlyCookies.get(ACCOUNT_SESSION_COOKIE_NAME)
      )
    ).resolves.toEqual({ kind: "unauthenticated" });
    await expect(
      login.authenticate({
        email: account.email,
        password: oldPassword,
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    const newSession = await login.authenticate({
      email: account.email,
      password: newPassword,
    });
    await expect(currentSessions.resolve(newSession.token)).resolves.toEqual({
      kind: "authenticated",
      principal: {
        sessionId: expect.any(String),
        accountId: account.id,
        clientId: client.id,
        email: account.email,
      },
    });
    expect(
      await db.accountSession.count({
        where: { accountId: account.id, revokedAt: null },
      })
    ).toBe(1);
  });

  it("uses bcrypt cost 12, replaces the old password, consumes once, and revokes sessions and alternate requests", async () => {
    const oldPassword = "old-password";
    const newPassword = "new-secure-password";
    const oldHash = await bcrypt.hash(oldPassword, 4);
    const { account } = await createAccount("bcrypt", oldHash);
    const clock = new FixedClock(new Date("2026-07-27T12:00:00.000Z"));
    const token = canonicalToken("bcrypt-reset");
    const recovery = await createRecovery(account.id, token, clock.value);
    const alternate = await createRecovery(
      account.id,
      canonicalToken("alternate-reset"),
      clock.value
    );
    const activeSession = await createSession(
      account.id,
      canonicalToken("active-session"),
      clock.value
    );
    const alreadyRevokedAt = new Date(clock.value);
    const terminalSession = await createSession(
      account.id,
      canonicalToken("terminal-session"),
      clock.value,
      alreadyRevokedAt
    );
    const service = resetService(
      resetStore,
      clock,
      (password) => bcrypt.hash(password, 12)
    );

    await expect(
      service.reset({ token, password: newPassword })
    ).resolves.toMatchObject({
      accountId: account.id,
      recoveryId: recovery.id,
      revokedSessions: 1,
      revokedRecoveries: 1,
    });

    const updated = await db.account.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(await bcrypt.compare(oldPassword, updated.passwordHash!)).toBe(
      false
    );
    expect(await bcrypt.compare(newPassword, updated.passwordHash!)).toBe(
      true
    );
    expect(bcrypt.getRounds(updated.passwordHash!)).toBe(12);
    expect(
      await db.accountPasswordRecovery.findUniqueOrThrow({
        where: { id: recovery.id },
      })
    ).toMatchObject({ consumedAt: clock.value, revokedAt: null });
    expect(
      await db.accountPasswordRecovery.findUniqueOrThrow({
        where: { id: alternate.id },
      })
    ).toMatchObject({ consumedAt: null, revokedAt: clock.value });
    expect(
      await db.accountSession.findUniqueOrThrow({
        where: { id: activeSession.id },
      })
    ).toMatchObject({ revokedAt: clock.value });
    expect(
      await db.accountSession.findUniqueOrThrow({
        where: { id: terminalSession.id },
      })
    ).toMatchObject({ revokedAt: alreadyRevokedAt });

    await expect(
      service.reset({ token, password: "second-password" })
    ).rejects.toBeInstanceOf(PasswordResetUnavailableError);
    expect(
      (await db.account.findUniqueOrThrow({ where: { id: account.id } }))
        .passwordHash
    ).toBe(updated.passwordHash);
  });

  it("rolls back password, consumption, and session revocation after an intermediate failure", async () => {
    const { account } = await createAccount("rollback");
    const clock = new FixedClock(new Date("2026-07-27T13:00:00.000Z"));
    const token = canonicalToken("rollback-reset");
    const recovery = await createRecovery(account.id, token, clock.value);
    const session = await createSession(
      account.id,
      canonicalToken("rollback-session"),
      clock.value
    );
    const failingStore: PasswordResetStore = {
      findByTokenHash: (tokenHash) =>
        resetStore.findByTokenHash(tokenHash),
      transaction: (work) =>
        resetStore.transaction((transaction) =>
          work(
            new Proxy(transaction, {
              get(target, property, receiver) {
                if (property === "revokeAllSessions") {
                  return async () => {
                    throw new Error("Injected session revocation failure");
                  };
                }
                const value = Reflect.get(target, property, receiver);
                return typeof value === "function"
                  ? value.bind(target)
                  : value;
              },
            })
          )
        ),
    };

    await expect(
      resetService(failingStore, clock).reset({
        token,
        password: "valid-password",
      })
    ).rejects.toThrow("Injected session revocation failure");

    expect(
      await db.account.findUniqueOrThrow({ where: { id: account.id } })
    ).toMatchObject({ passwordHash: "old-hash" });
    expect(
      await db.accountPasswordRecovery.findUniqueOrThrow({
        where: { id: recovery.id },
      })
    ).toMatchObject({ consumedAt: null, revokedAt: null });
    expect(
      await db.accountSession.findUniqueOrThrow({
        where: { id: session.id },
      })
    ).toMatchObject({ revokedAt: null });
  });

  it("rejects expiry reached between preliminary validation and locked revalidation", async () => {
    const { account } = await createAccount("expiry");
    const beforeExpiry = new Date("2026-07-27T14:00:00.000Z");
    const expiry = new Date(beforeExpiry.getTime() + 1);
    const token = canonicalToken("expiry-reset");
    const recovery = await createRecovery(account.id, token, beforeExpiry, {
      expiresAt: expiry,
    });
    const times = [beforeExpiry, expiry];
    const service = createPasswordResetService({
      store: resetStore,
      clock: { now: () => new Date(times.shift() ?? expiry) },
      tokenHasher: sha256TokenHasher,
      passwordHasher: { hash: async () => "new-hash" },
    });

    await expect(
      service.reset({ token, password: "valid-password" })
    ).rejects.toBeInstanceOf(PasswordResetUnavailableError);
    expect(
      await db.account.findUniqueOrThrow({ where: { id: account.id } })
    ).toMatchObject({ passwordHash: "old-hash" });
    expect(
      await db.accountPasswordRecovery.findUniqueOrThrow({
        where: { id: recovery.id },
      })
    ).toMatchObject({ consumedAt: null, revokedAt: null });
  });

  it("revalidates a concurrent account deactivation under the real lock", async () => {
    const { account } = await createAccount("deactivation");
    const clock = new FixedClock(new Date("2026-07-27T15:00:00.000Z"));
    const token = canonicalToken("deactivation-reset");
    const recovery = await createRecovery(account.id, token, clock.value);
    let signalHashed!: () => void;
    const hashed = new Promise<void>((resolve) => {
      signalHashed = resolve;
    });
    let releaseLock!: () => void;
    let signalLocked!: () => void;
    const locked = new Promise<void>((resolve) => {
      signalLocked = resolve;
    });
    const released = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const transition = connectionA.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id FROM "Account" WHERE id = ${account.id} FOR UPDATE
      `;
      signalLocked();
      await released;
      await transaction.account.update({
        where: { id: account.id },
        data: { status: "DISABLED" },
      });
    });
    await locked;
    const reset = resetService(resetStoreB, clock, async () => {
      signalHashed();
      return "new-hash";
    }).reset({ token, password: "valid-password" });

    await hashed;
    await new Promise<void>((resolve) => setImmediate(resolve));
    releaseLock();
    await transition;
    await expect(reset).rejects.toBeInstanceOf(
      PasswordResetUnavailableError
    );
    expect(
      await db.account.findUniqueOrThrow({ where: { id: account.id } })
    ).toMatchObject({ status: "DISABLED", passwordHash: "old-hash" });
    expect(
      await db.accountPasswordRecovery.findUniqueOrThrow({
        where: { id: recovery.id },
      })
    ).toMatchObject({ consumedAt: null, revokedAt: null });
  });

  it("serializes twelve same-token races over independent connections", async () => {
    const clock = new FixedClock(new Date("2026-07-27T16:00:00.000Z"));

    for (let iteration = 0; iteration < 12; iteration += 1) {
      clock.value = new Date(
        `2026-07-27T16:${String(iteration).padStart(2, "0")}:00.000Z`
      );
      const { account } = await createAccount(`race-${iteration}`);
      const token = canonicalToken(`race-reset-${iteration}`);
      const recovery = await createRecovery(account.id, token, clock.value);
      await createSession(
        account.id,
        canonicalToken(`race-session-${iteration}`),
        clock.value
      );
      const attempts = await Promise.allSettled([
        resetService(resetStoreA, clock).reset({
          token,
          password: `valid-winner-a-${iteration}`,
        }),
        resetService(resetStoreB, clock).reset({
          token,
          password: `valid-winner-b-${iteration}`,
        }),
      ]);

      const fulfilled = attempts.filter(
        (attempt) => attempt.status === "fulfilled"
      );
      const rejectionNames = attempts
        .filter(
          (attempt): attempt is PromiseRejectedResult =>
            attempt.status === "rejected"
        )
        .map((attempt) => attempt.reason?.constructor?.name ?? "Error")
        .join(", ");
      expect(fulfilled, rejectionNames).toHaveLength(1);
      const rejected = attempts.find(
        (attempt) => attempt.status === "rejected"
      ) as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(
        PasswordResetUnavailableError
      );
      expect(
        await db.accountPasswordRecovery.findUniqueOrThrow({
          where: { id: recovery.id },
        })
      ).toMatchObject({ consumedAt: clock.value, revokedAt: null });
      expect(
        await db.accountSession.count({
          where: { accountId: account.id, revokedAt: null },
        })
      ).toBe(0);
      expect(
        (await db.account.findUniqueOrThrow({ where: { id: account.id } }))
          .passwordHash
      ).toMatch(/^new-hash:valid-winner-[ab]-/);
    }
  });

  it("serializes reset against recovery requests over 12 independent races", async () => {
    const clock = new FixedClock(new Date("2026-07-27T17:00:00.000Z"));

    for (let iteration = 0; iteration < 12; iteration += 1) {
      clock.value = new Date(
        `2026-07-27T17:${String(iteration).padStart(2, "0")}:00.000Z`
      );
      const { account } = await createAccount(`request-race-${iteration}`);
      const oldToken = canonicalToken(`request-race-old-${iteration}`);
      const newToken = canonicalToken(`request-race-new-${iteration}`);
      const oldRecovery = await createRecovery(
        account.id,
        oldToken,
        clock.value
      );
      const request = createPasswordRecoveryService({
        store: createPrismaPasswordRecoveryStore(connectionB),
        clock,
        tokenGenerator: { generate: () => newToken },
        tokenHasher: sha256TokenHasher,
        durationMs: 60 * 60 * 1000,
        mailer: { send: vi.fn(async () => undefined) },
        logger: { deliveryFailed: vi.fn() },
      });

      const outcomes = await Promise.allSettled([
        resetService(resetStoreA, clock).reset({
          token: oldToken,
          password: `valid-password-${iteration}`,
        }),
        request.request(normalizeAccountEmail(account.email)),
      ]);
      expect(outcomes[1].status).toBe("fulfilled");
      if (outcomes[0].status === "rejected") {
        expect(outcomes[0].reason).toBeInstanceOf(
          PasswordResetUnavailableError
        );
      } else {
        expect(outcomes[0].value).toMatchObject({
          accountId: account.id,
          recoveryId: oldRecovery.id,
        });
      }

      const oldState =
        await db.accountPasswordRecovery.findUniqueOrThrow({
          where: { id: oldRecovery.id },
        });
      const open = await db.accountPasswordRecovery.findMany({
        where: {
          accountId: account.id,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: clock.value },
        },
      });

      expect(
        oldState.consumedAt !== null || oldState.revokedAt !== null
      ).toBe(true);
      expect(open).toHaveLength(1);
      expect(open[0].tokenHash).toBe(
        sha256TokenHasher.digest(newToken)
      );
    }
  });

  it("serializes reset against logout over 12 independent races", async () => {
    const clock = new FixedClock(new Date("2026-07-27T18:00:00.000Z"));
    const logoutSessions = createAccountSessionService({
      store: accountStoreB,
      clock,
      tokenGenerator: { generate: () => canonicalToken("unused-b") },
      tokenHasher: sha256TokenHasher,
      sessionDurationMs: 60 * 60 * 1000,
    });

    for (let iteration = 0; iteration < 12; iteration += 1) {
      clock.value = new Date(
        `2026-07-27T18:${String(iteration).padStart(2, "0")}:00.000Z`
      );
      const { account } = await createAccount(`session-race-${iteration}`);
      const resetToken = canonicalToken(`session-reset-${iteration}`);
      const sessionToken = canonicalToken(`session-token-${iteration}`);
      await createRecovery(account.id, resetToken, clock.value);
      await createSession(account.id, sessionToken, clock.value);

      const outcomes = await Promise.allSettled([
        resetService(resetStoreA, clock).reset({
          token: resetToken,
          password: `valid-password-${iteration}`,
        }),
        logoutSessions.revoke(sessionToken),
      ]);

      expect(outcomes[0].status).toBe("fulfilled");
      expect(outcomes[1].status).toBe("fulfilled");
      await expect(
        logoutSessions.validate(sessionToken)
      ).rejects.toBeInstanceOf(AccountSessionRevokedError);
      expect(
        await db.accountSession.count({
          where: { accountId: account.id, revokedAt: null },
        })
      ).toBe(0);
    }
  });

  it("serializes reset against session resolution over 12 independent races", async () => {
    const clock = new FixedClock(new Date("2026-07-27T19:00:00.000Z"));
    const resolvingSessions = createAccountSessionService({
      store: accountStoreC,
      clock,
      tokenGenerator: { generate: () => canonicalToken("unused-c") },
      tokenHasher: sha256TokenHasher,
      sessionDurationMs: 60 * 60 * 1000,
    });

    for (let iteration = 0; iteration < 12; iteration += 1) {
      clock.value = new Date(
        `2026-07-27T19:${String(iteration).padStart(2, "0")}:00.000Z`
      );
      const { account } = await createAccount(
        `resolution-race-${iteration}`
      );
      const resetToken = canonicalToken(`resolution-reset-${iteration}`);
      const sessionToken = canonicalToken(
        `resolution-session-${iteration}`
      );
      await createRecovery(account.id, resetToken, clock.value);
      await createSession(account.id, sessionToken, clock.value);

      const outcomes = await Promise.allSettled([
        resetService(resetStoreA, clock).reset({
          token: resetToken,
          password: `valid-password-${iteration}`,
        }),
        resolvingSessions.validate(sessionToken),
      ]);

      expect(outcomes[0].status).toBe("fulfilled");
      if (outcomes[1].status === "rejected") {
        expect(outcomes[1].reason).toBeInstanceOf(
          AccountSessionRevokedError
        );
      }
      await expect(
        resolvingSessions.validate(sessionToken)
      ).rejects.toBeInstanceOf(AccountSessionRevokedError);
      expect(
        await db.accountSession.count({
          where: { accountId: account.id, revokedAt: null },
        })
      ).toBe(0);
    }
  });
});
