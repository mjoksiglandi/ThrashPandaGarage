import { AccountStatus, PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import {
  afterAll,
  afterEach,
  describe,
  expect,
  it,
} from "vitest";
import { db } from "@/lib/db";
import {
  createPrismaAccountServiceStore,
  type AccountServiceStore,
} from "@/modules/accounts/account-service.repository";
import {
  sha256TokenHasher,
} from "@/modules/accounts/secure-token";
import {
  createPortalActorResolver,
} from "@/modules/portal/portal-actor.service";
import {
  createAccountSessionService,
} from "./account-session.service";
import {
  createCurrentAccountSessionService,
} from "./current-account-session.service";

const runId = `session_guard_${Date.now()}`;
const now = new Date("2026-07-26T18:00:00.000Z");
let sequence = 0;
const connectionA = new PrismaClient();
const connectionB = new PrismaClient();
const primaryStore = createPrismaAccountServiceStore();
const storeA = createPrismaAccountServiceStore(connectionA);
const storeB = createPrismaAccountServiceStore(connectionB);

function canonicalToken(label: string) {
  return createHash("sha256").update(label).digest("base64url");
}

function accountSessions(store: AccountServiceStore) {
  return createAccountSessionService({
    store,
    clock: { now: () => new Date(now) },
    tokenGenerator: { generate: () => canonicalToken("unused") },
    tokenHasher: sha256TokenHasher,
    sessionDurationMs: 60_000,
  });
}

function currentSessions(store: AccountServiceStore) {
  return createCurrentAccountSessionService({
    accountSessions: accountSessions(store),
  });
}

async function createClientAccount(
  label: string,
  status: AccountStatus = AccountStatus.ACTIVE
) {
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
      passwordHash: "fixture-hash",
      status,
    },
  });
  return { client, account };
}

async function persistSession(input: {
  accountId: string;
  label: string;
  expiresAt?: Date;
  revokedAt?: Date | null;
}) {
  const token = canonicalToken(`${runId}_${sequence}_${input.label}`);
  const session = await db.accountSession.create({
    data: {
      accountId: input.accountId,
      tokenHash: sha256TokenHasher.digest(token),
      createdAt: new Date(now.getTime() - 5 * 60_000),
      expiresAt:
        input.expiresAt ?? new Date(now.getTime() + 60_000),
      revokedAt: input.revokedAt ?? null,
    },
  });
  return { token, session };
}

function portalActors(store: AccountServiceStore = primaryStore) {
  return createPortalActorResolver({
    accountSessions: currentSessions(store),
  });
}

afterEach(async () => {
  await db.client.deleteMany({
    where: { name: { startsWith: runId } },
  });
});

afterAll(async () => {
  const residualClients = await db.client.count({
    where: { name: { startsWith: runId } },
  });
  const residualAccounts = await db.account.count({
    where: { email: { startsWith: runId } },
  });
  expect({ residualClients, residualAccounts }).toEqual({
    residualClients: 0,
    residualAccounts: 0,
  });
  await Promise.all([
    connectionA.$disconnect(),
    connectionB.$disconnect(),
    db.$disconnect(),
  ]);
});

describe("current account session resolution with PostgreSQL", () => {
  it("resolves the correct active account without sensitive fields", async () => {
    const { client, account } = await createClientAccount("valid");
    const { token } = await persistSession({
      accountId: account.id,
      label: "valid",
    });

    const resolution = await currentSessions(primaryStore).resolve(token);

    expect(resolution).toEqual({
      kind: "authenticated",
      principal: {
        accountId: account.id,
        clientId: client.id,
        email: account.email,
      },
    });
    const serialized = JSON.stringify(resolution);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain("tokenHash");
    expect(serialized).not.toContain("passwordHash");
  });

  it.each([
    {
      label: "expired",
      expiresAt: new Date(now.getTime() - 1),
      revokedAt: null,
      status: AccountStatus.ACTIVE,
    },
    {
      label: "revoked",
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: new Date(now.getTime() - 1),
      status: AccountStatus.ACTIVE,
    },
    {
      label: "disabled",
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: null,
      status: AccountStatus.DISABLED,
    },
  ])(
    "rejects a $label session server-side",
    async ({ label, expiresAt, revokedAt, status }) => {
      const { account } = await createClientAccount(label, status);
      const { token } = await persistSession({
        accountId: account.id,
        label,
        expiresAt,
        revokedAt,
      });

      await expect(
        currentSessions(primaryStore).resolve(token)
      ).resolves.toEqual({ kind: "unauthenticated" });
    }
  );

  it.each([
    undefined,
    "",
    "malformed",
    canonicalToken("unknown-random-session"),
  ])("does not authenticate an absent or invalid token", async (token) => {
    await expect(
      currentSessions(primaryStore).resolve(token)
    ).resolves.toEqual({ kind: "unauthenticated" });
  });
});

describe("account logout and concurrency with PostgreSQL", () => {
  it("revokes a valid session and remains successful when repeated", async () => {
    const { account } = await createClientAccount("logout");
    const { token, session } = await persistSession({
      accountId: account.id,
      label: "logout",
    });
    const service = currentSessions(primaryStore);

    await service.logout(token);
    await service.logout(token);

    expect(
      await db.accountSession.findUniqueOrThrow({
        where: { id: session.id },
      })
    ).toMatchObject({ revokedAt: now });
  });

  it("logs out an expired session without error", async () => {
    const { account } = await createClientAccount("expired_logout");
    const { token, session } = await persistSession({
      accountId: account.id,
      label: "expired_logout",
      expiresAt: new Date(now.getTime() - 1),
    });

    await expect(
      currentSessions(primaryStore).logout(token)
    ).resolves.toBeUndefined();
    expect(
      await db.accountSession.findUniqueOrThrow({
        where: { id: session.id },
      })
    ).toMatchObject({ revokedAt: now });
  });

  it("serializes two concurrent logouts over 12 independent sessions", async () => {
    const { account } = await createClientAccount("logout_race");
    const serviceA = currentSessions(storeA);
    const serviceB = currentSessions(storeB);

    for (let iteration = 0; iteration < 12; iteration += 1) {
      const { token, session } = await persistSession({
        accountId: account.id,
        label: `logout_race_${iteration}`,
      });

      await expect(
        Promise.all([serviceA.logout(token), serviceB.logout(token)])
      ).resolves.toEqual([undefined, undefined]);
      expect(
        await db.accountSession.findUniqueOrThrow({
          where: { id: session.id },
        })
      ).toMatchObject({ revokedAt: now });
    }
  });

  it("linearizes concurrent resolution and logout over 12 iterations", async () => {
    const { account } = await createClientAccount("resolve_logout_race");
    const serviceA = currentSessions(storeA);
    const serviceB = currentSessions(storeB);

    for (let iteration = 0; iteration < 12; iteration += 1) {
      const { token } = await persistSession({
        accountId: account.id,
        label: `resolve_logout_race_${iteration}`,
      });

      const [resolution] = await Promise.all([
        serviceA.resolve(token),
        serviceB.logout(token),
      ]);
      expect(["authenticated", "unauthenticated"]).toContain(
        resolution.kind
      );
      await expect(serviceA.resolve(token)).resolves.toEqual({
        kind: "unauthenticated",
      });
    }
  });
});

describe("account-only portal actor with PostgreSQL", () => {
  it("uses the client linked to the account session", async () => {
    const linked = await createClientAccount("linked");
    const { token } = await persistSession({
      accountId: linked.account.id,
      label: "linked",
    });

    await expect(
      portalActors().resolve(token)
    ).resolves.toEqual({
      kind: "account",
      accountId: linked.account.id,
      clientId: linked.client.id,
      email: linked.account.email,
    });
  });

  it("returns anonymous after account-session revocation", async () => {
    const accountOwner = await createClientAccount("revoked_owner");
    const { token } = await persistSession({
      accountId: accountOwner.account.id,
      label: "revoked_cutover",
      revokedAt: new Date(now.getTime() - 1),
    });

    await expect(
      portalActors().resolve(token)
    ).resolves.toEqual({ kind: "anonymous" });
  });

  it("returns anonymous after account-session expiry", async () => {
    const accountOwner = await createClientAccount("expired_owner");
    const { token } = await persistSession({
      accountId: accountOwner.account.id,
      label: "expired_cutover",
      expiresAt: new Date(now.getTime() - 1),
    });

    await expect(
      portalActors().resolve(token)
    ).resolves.toEqual({ kind: "anonymous" });
  });

  it("returns anonymous for an inactive account", async () => {
    const accountOwner = await createClientAccount(
      "inactive_owner",
      AccountStatus.DISABLED
    );
    const { token } = await persistSession({
      accountId: accountOwner.account.id,
      label: "inactive_cutover",
    });

    await expect(
      portalActors().resolve(token)
    ).resolves.toEqual({ kind: "anonymous" });
  });

  it("returns anonymous without an account session", async () => {
    await expect(portalActors().resolve(undefined)).resolves.toEqual({
      kind: "anonymous",
    });
  });
});
