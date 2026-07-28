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
import { sha256TokenHasher } from "@/modules/accounts/secure-token";
import {
  createPrismaPasswordRecoveryStore,
  type PasswordRecoveryStore,
} from "./password-recovery.repository";
import {
  createPasswordRecoveryService,
} from "./password-recovery.service";

const runId = `password_recovery_${Date.now()}`;
let sequence = 0;
const connectionA = new PrismaClient();
const connectionB = new PrismaClient();
const primaryStore = createPrismaPasswordRecoveryStore();
const storeA = createPrismaPasswordRecoveryStore(connectionA);
const storeB = createPrismaPasswordRecoveryStore(connectionB);

class FixedClock {
  constructor(public value: Date) {}

  now() {
    return new Date(this.value);
  }
}

function canonicalToken(label: string) {
  return Buffer.from(label).toString("base64url").padEnd(43, "_");
}

async function createAccount(
  label: string,
  options: {
    status?: "INVITED" | "ACTIVE" | "LOCKED" | "DISABLED";
    passwordHash?: string | null;
  } = {}
) {
  sequence += 1;
  const client = await db.client.create({
    data: {
      name: `${runId}_${sequence}_${label}`,
      email: `${runId}_${sequence}@example.test`,
    },
  });
  const status = options.status ?? "ACTIVE";
  const account = await db.account.create({
    data: {
      clientId: client.id,
      email: `${runId}_${sequence}_${label}@example.test`,
      status,
      passwordHash:
        options.passwordHash === undefined
          ? status === "INVITED"
            ? null
            : "password-hash"
          : options.passwordHash,
    },
  });
  return { account, client };
}

function recoveryService(input: {
  store: PasswordRecoveryStore;
  clock: FixedClock;
  token: string;
  sent?: string[];
  smtpFailure?: boolean;
  logger?: (input: {
    recoveryId: string;
    accountId: string;
  }) => void;
}) {
  return createPasswordRecoveryService({
    store: input.store,
    clock: input.clock,
    tokenGenerator: {
      generate: () => input.token,
    },
    tokenHasher: sha256TokenHasher,
    durationMs: 60 * 60 * 1000,
    mailer: {
      async send(message) {
        input.sent?.push(message.token);
        if (input.smtpFailure) throw new Error("SMTP unavailable");
      },
    },
    logger: {
      deliveryFailed: input.logger ?? vi.fn(),
    },
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
});

afterAll(async () => {
  await Promise.all([
    connectionA.$disconnect(),
    connectionB.$disconnect(),
    db.$disconnect(),
  ]);
});

describe("password recovery with PostgreSQL", () => {
  it("persists only the digest, exact expiry, indexes relation data, and cascades", async () => {
    const { account, client } = await createAccount("persistence");
    const clock = new FixedClock(
      new Date("2026-07-26T12:00:00.000Z")
    );
    const plainToken = canonicalToken("persisted-secret");
    const sent: string[] = [];
    const service = recoveryService({
      store: primaryStore,
      clock,
      token: plainToken,
      sent,
    });

    await service.request(normalizeAccountEmail(account.email));

    const recovery =
      await db.accountPasswordRecovery.findFirstOrThrow({
        where: { accountId: account.id },
      });
    expect(recovery.tokenHash).toBe(
      sha256TokenHasher.digest(plainToken)
    );
    expect(recovery.tokenHash).not.toBe(plainToken);
    expect(JSON.stringify(recovery)).not.toContain(plainToken);
    expect(recovery.expiresAt).toEqual(
      new Date("2026-07-26T13:00:00.000Z")
    );
    expect(recovery).toMatchObject({
      consumedAt: null,
      revokedAt: null,
      createdAt: clock.value,
    });
    expect(sent).toEqual([plainToken]);

    await db.client.delete({ where: { id: client.id } });
    expect(
      await db.accountPasswordRecovery.count({
        where: { accountId: account.id },
      })
    ).toBe(0);
  });

  it("revokes the previous request atomically and leaves one open", async () => {
    const { account } = await createAccount("replacement");
    const clock = new FixedClock(
      new Date("2026-07-26T13:00:00.000Z")
    );
    const first = recoveryService({
      store: primaryStore,
      clock,
      token: canonicalToken("replacement-one"),
    });
    await first.request(normalizeAccountEmail(account.email));

    clock.value = new Date("2026-07-26T13:01:00.000Z");
    const second = recoveryService({
      store: primaryStore,
      clock,
      token: canonicalToken("replacement-two"),
    });
    await second.request(normalizeAccountEmail(account.email));

    const recoveries =
      await db.accountPasswordRecovery.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: "asc" },
      });
    expect(recoveries).toHaveLength(2);
    expect(recoveries[0].revokedAt).toEqual(clock.value);
    expect(recoveries[1].revokedAt).toBeNull();
  });

  it("rolls back revocation when creating the replacement fails", async () => {
    const { account } = await createAccount("rollback");
    const clock = new FixedClock(
      new Date("2026-07-26T14:00:00.000Z")
    );
    const repeatedToken = canonicalToken("duplicate-token");
    const first = recoveryService({
      store: primaryStore,
      clock,
      token: repeatedToken,
    });
    await first.request(normalizeAccountEmail(account.email));

    clock.value = new Date("2026-07-26T14:01:00.000Z");
    const duplicate = recoveryService({
      store: primaryStore,
      clock,
      token: repeatedToken,
    });
    await expect(
      duplicate.request(normalizeAccountEmail(account.email))
    ).rejects.toThrow();

    const recoveries =
      await db.accountPasswordRecovery.findMany({
        where: { accountId: account.id },
      });
    expect(recoveries).toHaveLength(1);
    expect(recoveries[0].revokedAt).toBeNull();
  });

  it("enforces digest, temporal, and terminal-state constraints", async () => {
    const { account } = await createAccount("constraints");
    const createdAt = new Date("2026-07-26T14:30:00.000Z");
    const validHash = sha256TokenHasher.digest(
      canonicalToken("constraint-token")
    );

    await expect(
      db.accountPasswordRecovery.create({
        data: {
          accountId: account.id,
          tokenHash: "plain-token",
          createdAt,
          expiresAt: new Date(createdAt.getTime() + 60_000),
        },
      })
    ).rejects.toBeDefined();
    await expect(
      db.accountPasswordRecovery.create({
        data: {
          accountId: account.id,
          tokenHash: validHash,
          createdAt,
          expiresAt: createdAt,
        },
      })
    ).rejects.toBeDefined();
    await expect(
      db.accountPasswordRecovery.create({
        data: {
          accountId: account.id,
          tokenHash: validHash,
          createdAt,
          expiresAt: new Date(createdAt.getTime() + 60_000),
          consumedAt: createdAt,
          revokedAt: createdAt,
        },
      })
    ).rejects.toBeDefined();
  });

  it("revokes the new request after SMTP failure without reviving the previous one", async () => {
    const { account } = await createAccount("smtp_failure");
    const clock = new FixedClock(
      new Date("2026-07-26T15:00:00.000Z")
    );
    await recoveryService({
      store: primaryStore,
      clock,
      token: canonicalToken("smtp-first"),
    }).request(normalizeAccountEmail(account.email));

    clock.value = new Date("2026-07-26T15:01:00.000Z");
    const logger = vi.fn();
    await recoveryService({
      store: primaryStore,
      clock,
      token: canonicalToken("smtp-second"),
      smtpFailure: true,
      logger,
    }).request(normalizeAccountEmail(account.email));

    const recoveries =
      await db.accountPasswordRecovery.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: "asc" },
      });
    expect(recoveries).toHaveLength(2);
    expect(recoveries.every((recovery) => recovery.revokedAt !== null)).toBe(
      true
    );
    expect(logger).toHaveBeenCalledWith({
      recoveryId: recoveries[1].id,
      accountId: account.id,
    });
    expect(JSON.stringify(logger.mock.calls)).not.toContain(
      canonicalToken("smtp-second")
    );
  });

  it("revalidates account state after waiting for the account lock", async () => {
    const { account } = await createAccount("state_transition");
    const clock = new FixedClock(
      new Date("2026-07-26T16:00:00.000Z")
    );
    let signalLocked!: () => void;
    let releaseLock!: () => void;
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
    const sent: string[] = [];
    const request = recoveryService({
      store: storeB,
      clock,
      token: canonicalToken("state-transition"),
      sent,
    }).request(normalizeAccountEmail(account.email));
    releaseLock();
    await Promise.all([transition, request]);

    expect(sent).toHaveLength(0);
    expect(
      await db.accountPasswordRecovery.count({
        where: { accountId: account.id },
      })
    ).toBe(0);
  });

  it("serializes twelve concurrent request races over independent connections", async () => {
    const { account } = await createAccount("race");
    const clock = new FixedClock(
      new Date("2026-07-26T17:00:00.000Z")
    );
    const sent: string[] = [];

    for (let iteration = 0; iteration < 12; iteration += 1) {
      clock.value = new Date(
        `2026-07-26T17:${String(iteration).padStart(2, "0")}:00.000Z`
      );
      const serviceA = recoveryService({
        store: storeA,
        clock,
        token: canonicalToken(`race-${iteration}-a`),
        sent,
      });
      const serviceB = recoveryService({
        store: storeB,
        clock,
        token: canonicalToken(`race-${iteration}-b`),
        sent,
      });

      await Promise.all([
        serviceA.request(normalizeAccountEmail(account.email)),
        serviceB.request(normalizeAccountEmail(account.email)),
      ]);

      expect(
        await db.accountPasswordRecovery.count({
          where: {
            accountId: account.id,
            consumedAt: null,
            revokedAt: null,
            expiresAt: { gt: clock.value },
          },
        })
      ).toBe(1);
    }

    const recoveries =
      await db.accountPasswordRecovery.findMany({
        where: { accountId: account.id },
      });
    expect(recoveries).toHaveLength(24);
    expect(sent).toHaveLength(24);
    const persistedDigests = new Set(
      recoveries.map((recovery) => recovery.tokenHash)
    );
    for (const sentToken of sent) {
      expect(persistedDigests.has(sha256TokenHasher.digest(sentToken))).toBe(
        true
      );
    }
  });
});
