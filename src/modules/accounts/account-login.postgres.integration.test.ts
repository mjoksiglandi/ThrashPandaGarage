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
import {
  createAccountSessionService,
} from "@/modules/account-sessions/account-session.service";
import {
  createInvitationAcceptanceService,
} from "@/modules/invitations/invitation.service";
import {
  createPrismaAccountServiceStore,
  type AccountServiceStore,
} from "./account-service.repository";
import {
  createAccountLoginService,
} from "./account-login.service";
import {
  createAuthenticationAttemptService,
} from "./authentication-attempt.service";
import {
  InvalidCredentialsError,
} from "./account.errors";
import {
  sha256TokenHasher,
} from "./secure-token";

const runId = `account_login_${Date.now()}`;
const correctPassword = "correct-account-password";
const dummyHash = bcrypt.hashSync("nonexistent-account", 4);
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

function canonicalTestToken(label: string) {
  return Buffer.from(label).toString("base64url").padEnd(43, "_");
}

function deterministicToken(label: string) {
  return {
    generate: () => canonicalTestToken(label),
  };
}

function verificationGate(expectedCalls: number) {
  let calls = 0;
  let markStarted!: () => void;
  let releaseVerification!: () => void;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const released = new Promise<void>((resolve) => {
    releaseVerification = resolve;
  });

  return {
    started,
    release: releaseVerification,
    verifier: {
      async verify(password: string, passwordHash: string) {
        calls += 1;
        if (calls === expectedCalls) {
          markStarted();
        }
        await released;
        return bcrypt.compare(password, passwordHash);
      },
    },
  };
}

async function createAccount(
  label: string,
  options: {
    status?: "INVITED" | "ACTIVE" | "LOCKED" | "DISABLED";
    failedLoginAttempts?: number;
    lockedUntil?: Date | null;
  } = {}
) {
  sequence += 1;
  const canonicalLabel = label.toLowerCase();
  const client = await db.client.create({
    data: {
      name: `${runId}_${sequence}_${label}`,
      email: `${runId}_${sequence}@example.test`,
    },
  });
  const status = options.status ?? "ACTIVE";
  const passwordHash =
    status === "INVITED"
      ? null
      : await bcrypt.hash(correctPassword, 4);
  const account = await db.account.create({
    data: {
      clientId: client.id,
      email: `${runId}_${sequence}_${canonicalLabel}@example.test`,
      passwordHash,
      status,
      failedLoginAttempts: options.failedLoginAttempts ?? 0,
      lockedUntil:
        status === "LOCKED"
          ? options.lockedUntil ??
            new Date("2026-07-26T13:00:00.000Z")
          : null,
    },
  });
  return { account, client, passwordHash };
}

function loginService(
  store: AccountServiceStore,
  clock: FixedClock,
  tokenLabel: string,
  options: {
    threshold?: number;
    tokenGenerator?: { generate(): string };
    passwordVerifier?: {
      verify(password: string, passwordHash: string): Promise<boolean>;
    };
  } = {}
) {
  const authenticationAttempts =
    createAuthenticationAttemptService({
      store,
      clock,
      lockPolicy: {
        failedAttemptThreshold: options.threshold ?? 5,
        lockDurationMs: 60_000,
      },
    });
  const accountSessions = createAccountSessionService({
    store,
    clock,
    tokenGenerator:
      options.tokenGenerator ?? deterministicToken(tokenLabel),
    tokenHasher: sha256TokenHasher,
    sessionDurationMs: 30 * 24 * 60 * 60 * 1000,
  });
  return createAccountLoginService({
    store,
    authenticationAttempts,
    accountSessions,
    passwordVerifier: options.passwordVerifier ?? {
      verify: (password, passwordHash) =>
        bcrypt.compare(password, passwordHash),
    },
    nonexistentAccountPasswordHash: dummyHash,
  });
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

describe("account login with PostgreSQL", () => {
  it("persists only the session digest, exact expiry, and successful attempt state", async () => {
    const { account, passwordHash } = await createAccount("success", {
      failedLoginAttempts: 2,
    });
    const clock = new FixedClock(
      new Date("2026-07-26T12:00:00.000Z")
    );
    const service = loginService(
      primaryStore,
      clock,
      "success-token"
    );

    const result = await service.authenticate({
      email: account.email.toUpperCase(),
      password: correctPassword,
    });
    const persistedAccount =
      await db.account.findUniqueOrThrow({
        where: { id: account.id },
      });
    const session =
      await db.accountSession.findFirstOrThrow({
        where: { accountId: account.id },
      });

    expect(result.expiresAt).toEqual(
      new Date("2026-08-25T12:00:00.000Z")
    );
    expect(session.tokenHash).toBe(
      sha256TokenHasher.digest(result.token)
    );
    expect(session.tokenHash).not.toBe(result.token);
    expect(session.expiresAt).toEqual(result.expiresAt);
    expect(persistedAccount).toMatchObject({
      status: "ACTIVE",
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: clock.value,
      passwordHash,
    });
  });

  it("persists failed attempts for an existing account and performs bcrypt for a nonexistent one", async () => {
    const { account } = await createAccount("failure");
    const clock = new FixedClock(
      new Date("2026-07-26T12:05:00.000Z")
    );
    const existing = loginService(
      primaryStore,
      clock,
      "unused-existing"
    );
    const verify = vi.fn(async () => false);
    const missing = loginService(
      primaryStore,
      clock,
      "unused-missing",
      { passwordVerifier: { verify } }
    );

    await expect(
      existing.authenticate({
        email: account.email,
        password: "wrong password",
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(
      missing.authenticate({
        email: `${runId}_missing@example.test`,
        password: "wrong password",
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(
      await db.account.findUniqueOrThrow({
        where: { id: account.id },
      })
    ).toMatchObject({
      failedLoginAttempts: 1,
      status: "ACTIVE",
    });
    expect(verify).toHaveBeenCalledWith(
      "wrong password",
      dummyHash
    );
    expect(
      await db.accountSession.count({
        where: { accountId: account.id },
      })
    ).toBe(0);
  });

  it("resets permitted failures on success and rejects authentication after the threshold", async () => {
    const { account } = await createAccount("attempt_policy");
    const clock = new FixedClock(
      new Date("2026-07-26T12:10:00.000Z")
    );
    const service = loginService(
      primaryStore,
      clock,
      "policy-token",
      { threshold: 3 }
    );

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        service.authenticate({
          email: account.email,
          password: "wrong password",
        })
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    }
    await expect(
      service.authenticate({
        email: account.email,
        password: correctPassword,
      })
    ).resolves.toMatchObject({ token: expect.any(String) });
    expect(
      await db.account.findUniqueOrThrow({
        where: { id: account.id },
      })
    ).toMatchObject({
      failedLoginAttempts: 0,
      status: "ACTIVE",
      lockedUntil: null,
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(
        service.authenticate({
          email: account.email,
          password: "wrong password",
        })
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    }
    await expect(
      service.authenticate({
        email: account.email,
        password: correctPassword,
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(
      await db.account.findUniqueOrThrow({
        where: { id: account.id },
      })
    ).toMatchObject({
      failedLoginAttempts: 3,
      status: "LOCKED",
      lockedUntil: new Date("2026-07-26T12:11:00.000Z"),
    });
  });

  it.each(["INVITED", "LOCKED", "DISABLED"] as const)(
    "rejects a %s account without creating a session",
    async (status) => {
      const { account } = await createAccount(`status_${status}`, {
        status,
      });
      const clock = new FixedClock(
        new Date("2026-07-26T12:15:00.000Z")
      );
      const service = loginService(
        primaryStore,
        clock,
        `status-token-${status}`
      );

      await expect(
        service.authenticate({
          email: account.email,
          password: correctPassword,
        })
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
      expect(
        await db.accountSession.count({
          where: { accountId: account.id },
        })
      ).toBe(0);
    }
  );

  it("serializes two correct logins into two unique sessions", async () => {
    const { account } = await createAccount("two_successes");
    const clock = new FixedClock(
      new Date("2026-07-26T12:20:00.000Z")
    );
    const gate = verificationGate(2);
    const serviceA = loginService(
      storeA,
      clock,
      "concurrent-success-a",
      { passwordVerifier: gate.verifier }
    );
    const serviceB = loginService(
      storeB,
      clock,
      "concurrent-success-b",
      { passwordVerifier: gate.verifier }
    );

    const authentications = [
      serviceA.authenticate({
        email: account.email,
        password: correctPassword,
      }),
      serviceB.authenticate({
        email: account.email,
        password: correctPassword,
      }),
    ];
    await gate.started;
    gate.release();
    const results = await Promise.all(authentications);

    expect(new Set(results.map((result) => result.token)).size).toBe(2);
    expect(
      await db.accountSession.count({
        where: { accountId: account.id },
      })
    ).toBe(2);
    expect(
      await db.account.findUniqueOrThrow({
        where: { id: account.id },
      })
    ).toMatchObject({
      status: "ACTIVE",
      failedLoginAttempts: 0,
    });
  });

  it("does not lose state during a correct and failed concurrent login", async () => {
    const { account } = await createAccount("mixed_race");
    const clock = new FixedClock(
      new Date("2026-07-26T12:25:00.000Z")
    );
    const gate = verificationGate(2);
    const successful = loginService(
      storeA,
      clock,
      "mixed-success",
      { passwordVerifier: gate.verifier }
    );
    const failed = loginService(
      storeB,
      clock,
      "mixed-unused",
      { passwordVerifier: gate.verifier }
    );

    const authentications = [
      successful.authenticate({
        email: account.email,
        password: correctPassword,
      }),
      failed.authenticate({
        email: account.email,
        password: "wrong password",
      }),
    ];
    await gate.started;
    gate.release();
    const results = await Promise.allSettled(authentications);
    const persisted =
      await db.account.findUniqueOrThrow({
        where: { id: account.id },
      });

    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected")
    ).toHaveLength(1);
    expect(persisted.status).toBe("ACTIVE");
    expect([0, 1]).toContain(persisted.failedLoginAttempts);
    expect(persisted.lastLoginAt).toEqual(clock.value);
    expect(
      await db.accountSession.count({
        where: { accountId: account.id },
      })
    ).toBe(1);
  });

  it("serializes concurrent failed attempts without overwriting either increment", async () => {
    const { account } = await createAccount("failed_race");
    const clock = new FixedClock(
      new Date("2026-07-26T12:30:00.000Z")
    );
    const serviceA = loginService(
      storeA,
      clock,
      "failed-unused-a",
      { threshold: 5 }
    );
    const serviceB = loginService(
      storeB,
      clock,
      "failed-unused-b",
      { threshold: 5 }
    );

    await Promise.allSettled([
      serviceA.authenticate({
        email: account.email,
        password: "wrong password a",
      }),
      serviceB.authenticate({
        email: account.email,
        password: "wrong password b",
      }),
    ]);

    expect(
      await db.account.findUniqueOrThrow({
        where: { id: account.id },
      })
    ).toMatchObject({
      status: "ACTIVE",
      failedLoginAttempts: 2,
    });
  });

  it("allows exactly one concurrent failure to persist the fifth-attempt lock", async () => {
    const { account } = await createAccount("fifth_failure_race", {
      failedLoginAttempts: 4,
    });
    const clock = new FixedClock(
      new Date("2026-07-26T12:32:00.000Z")
    );
    const gate = verificationGate(2);
    const serviceA = loginService(
      storeA,
      clock,
      "fifth-unused-a",
      { threshold: 5, passwordVerifier: gate.verifier }
    );
    const serviceB = loginService(
      storeB,
      clock,
      "fifth-unused-b",
      { threshold: 5, passwordVerifier: gate.verifier }
    );

    const authentications = [
      serviceA.authenticate({
        email: account.email,
        password: "wrong password a",
      }),
      serviceB.authenticate({
        email: account.email,
        password: "wrong password b",
      }),
    ];
    await gate.started;
    gate.release();
    const results = await Promise.allSettled(authentications);

    expect(
      results.every((result) => result.status === "rejected")
    ).toBe(true);
    expect(
      await db.account.findUniqueOrThrow({
        where: { id: account.id },
      })
    ).toMatchObject({
      status: "LOCKED",
      failedLoginAttempts: 5,
      lockedUntil: new Date("2026-07-26T12:33:00.000Z"),
    });
    expect(
      await db.accountSession.count({
        where: { accountId: account.id },
      })
    ).toBe(0);
  });

  it("rejects a verified password when the hash changes before the locked revalidation", async () => {
    const { account } = await createAccount("password_change_race");
    const clock = new FixedClock(
      new Date("2026-07-26T12:33:00.000Z")
    );
    const gate = verificationGate(1);
    const service = loginService(
      storeA,
      clock,
      "password-change-unused",
      { passwordVerifier: gate.verifier }
    );

    const authentication = service.authenticate({
      email: account.email,
      password: correctPassword,
    });
    await gate.started;
    const replacementHash = await bcrypt.hash(
      "replacement-account-password",
      4
    );
    await db.account.update({
      where: { id: account.id },
      data: { passwordHash: replacementHash },
    });
    gate.release();

    await expect(authentication).rejects.toBeInstanceOf(
      InvalidCredentialsError
    );
    expect(
      await db.account.findUniqueOrThrow({
        where: { id: account.id },
      })
    ).toMatchObject({
      passwordHash: replacementHash,
      failedLoginAttempts: 0,
      lastLoginAt: null,
    });
    expect(
      await db.accountSession.count({
        where: { accountId: account.id },
      })
    ).toBe(0);
  });

  it("rejects a verified password when a concurrent failure locks the account", async () => {
    const { account } = await createAccount("lock_race");
    const clock = new FixedClock(
      new Date("2026-07-26T12:34:00.000Z")
    );
    const gate = verificationGate(1);
    const service = loginService(
      storeA,
      clock,
      "lock-unused",
      { passwordVerifier: gate.verifier }
    );

    const authentication = service.authenticate({
      email: account.email,
      password: correctPassword,
    });
    await gate.started;
    await db.account.update({
      where: { id: account.id },
      data: {
        status: "LOCKED",
        failedLoginAttempts: 5,
        lockedUntil: new Date("2026-07-26T12:49:00.000Z"),
      },
    });
    gate.release();

    await expect(authentication).rejects.toBeInstanceOf(
      InvalidCredentialsError
    );
    expect(
      await db.account.findUniqueOrThrow({
        where: { id: account.id },
      })
    ).toMatchObject({
      status: "LOCKED",
      failedLoginAttempts: 5,
      lockedUntil: new Date("2026-07-26T12:49:00.000Z"),
      lastLoginAt: null,
    });
    expect(
      await db.accountSession.count({
        where: { accountId: account.id },
      })
    ).toBe(0);
  });

  it("revalidates a concurrent disable after bcrypt and before session creation", async () => {
    const { account } = await createAccount("disable_race");
    const clock = new FixedClock(
      new Date("2026-07-26T12:35:00.000Z")
    );
    let releaseVerification!: () => void;
    let verificationStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      verificationStarted = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseVerification = resolve;
    });
    const service = loginService(
      storeA,
      clock,
      "disable-unused",
      {
        passwordVerifier: {
          async verify() {
            verificationStarted();
            await release;
            return true;
          },
        },
      }
    );

    const authentication = service.authenticate({
      email: account.email,
      password: correctPassword,
    });
    await started;
    await db.account.update({
      where: { id: account.id },
      data: { status: "DISABLED", lockedUntil: null },
    });
    releaseVerification();

    await expect(authentication).rejects.toBeInstanceOf(
      InvalidCredentialsError
    );
    expect(
      await db.accountSession.count({
        where: { accountId: account.id },
      })
    ).toBe(0);
  });

  it("does not authenticate stale INVITED state while invitation acceptance holds the account lock", async () => {
    const { account } = await createAccount(
      "invitation_acceptance_race",
      { status: "INVITED" }
    );
    const clock = new FixedClock(
      new Date("2026-07-26T12:37:00.000Z")
    );
    const token = canonicalTestToken("acceptance-race");
    const invitation = await db.invitation.create({
      data: {
        accountId: account.id,
        tokenHash: sha256TokenHasher.digest(token),
        expiresAt: new Date("2026-07-26T12:38:00.000Z"),
        createdAt: clock.value,
        createdByActorId: "race-admin",
      },
    });
    const loginGate = verificationGate(1);
    const login = loginService(
      storeA,
      clock,
      "invitation-login-unused",
      { passwordVerifier: loginGate.verifier }
    );
    let markAcceptanceHashStarted!: () => void;
    let releaseAcceptanceHash!: () => void;
    const acceptanceHashStarted = new Promise<void>((resolve) => {
      markAcceptanceHashStarted = resolve;
    });
    const acceptanceHashReleased = new Promise<void>((resolve) => {
      releaseAcceptanceHash = resolve;
    });
    const acceptance = createInvitationAcceptanceService({
      store: storeB,
      clock,
      tokenHasher: sha256TokenHasher,
      passwordHasher: {
        async hash(password) {
          markAcceptanceHashStarted();
          await acceptanceHashReleased;
          return bcrypt.hash(password, 4);
        },
        verify: (password, passwordHash) =>
          bcrypt.compare(password, passwordHash),
      },
    });

    const authentication = login.authenticate({
      email: account.email,
      password: correctPassword,
    });
    await loginGate.started;
    const activation = acceptance.accept({
      token,
      password: correctPassword,
    });
    await acceptanceHashStarted;
    loginGate.release();
    releaseAcceptanceHash();

    await expect(activation).resolves.toMatchObject({
      accountId: account.id,
      status: "ACTIVE",
    });
    await expect(authentication).rejects.toBeInstanceOf(
      InvalidCredentialsError
    );
    expect(
      await db.account.findUniqueOrThrow({
        where: { id: account.id },
      })
    ).toMatchObject({
      status: "ACTIVE",
      failedLoginAttempts: 1,
      lastLoginAt: null,
    });
    expect(
      await db.invitation.findUniqueOrThrow({
        where: { id: invitation.id },
      })
    ).toMatchObject({
      acceptedAt: clock.value,
      revokedAt: null,
    });
    expect(
      await db.accountSession.count({
        where: { accountId: account.id },
      })
    ).toBe(0);
  });

  it("rolls back the successful-attempt update when session creation fails", async () => {
    const { account } = await createAccount("session_rollback", {
      failedLoginAttempts: 2,
    });
    const clock = new FixedClock(
      new Date("2026-07-26T12:40:00.000Z")
    );
    const service = loginService(
      primaryStore,
      clock,
      "unused",
      {
        tokenGenerator: {
          generate: () => "not-a-canonical-token",
        },
      }
    );

    await expect(
      service.authenticate({
        email: account.email,
        password: correctPassword,
      })
    ).rejects.toThrow();
    expect(
      await db.account.findUniqueOrThrow({
        where: { id: account.id },
      })
    ).toMatchObject({
      status: "ACTIVE",
      failedLoginAttempts: 2,
      lastLoginAt: null,
    });
    expect(
      await db.accountSession.count({
        where: { accountId: account.id },
      })
    ).toBe(0);
  });

  it("rolls back attempt reset when a reused digest collides during session persistence", async () => {
    const { account } = await createAccount("session_collision", {
      failedLoginAttempts: 2,
    });
    const clock = new FixedClock(
      new Date("2026-07-26T12:45:00.000Z")
    );
    const collidingToken = canonicalTestToken(
      "session-digest-collision"
    );
    await db.accountSession.create({
      data: {
        accountId: account.id,
        tokenHash: sha256TokenHasher.digest(collidingToken),
        createdAt: clock.value,
        expiresAt: new Date("2026-07-26T13:45:00.000Z"),
      },
    });
    const service = loginService(
      primaryStore,
      clock,
      "unused",
      {
        tokenGenerator: {
          generate: () => collidingToken,
        },
      }
    );

    await expect(
      service.authenticate({
        email: account.email,
        password: correctPassword,
      })
    ).rejects.toThrow();
    expect(
      await db.account.findUniqueOrThrow({
        where: { id: account.id },
      })
    ).toMatchObject({
      status: "ACTIVE",
      failedLoginAttempts: 2,
      lastLoginAt: null,
    });
    expect(
      await db.accountSession.count({
        where: { accountId: account.id },
      })
    ).toBe(1);
  });
});
