import { AccountStatus, GalleryStatus, PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import {
  afterAll,
  afterEach,
  describe,
  expect,
  it,
} from "vitest";
import PrivateGalleryPage from "@/app/g/[token]/page";
import { db } from "@/lib/db";
import {
  createAccountSessionService,
} from "./account-session.service";
import {
  createPrismaAccountServiceStore,
  type AccountServiceStore,
} from "@/modules/accounts/account-service.repository";
import { sha256TokenHasher } from "@/modules/accounts/secure-token";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { updateSelectionFromClient } from "@/modules/selections/selection.service";
import {
  createPrismaAccountSessionManagementStore,
  type AccountSessionManagementStore,
} from "./account-session-management.repository";
import {
  createAccountSessionManagementService,
} from "./account-session-management.service";
import {
  createCurrentAccountSessionService,
} from "./current-account-session.service";

const runId = `account_session_management_${Date.now()}`;
const now = new Date("2030-01-02T03:04:05.000Z");
let sequence = 0;
let sessionSequence = 0;
const connectionA = new PrismaClient();
const connectionB = new PrismaClient();
const connectionC = new PrismaClient();

function canonicalToken(label: string) {
  return createHash("sha256").update(label).digest("base64url");
}

function management(store: AccountSessionManagementStore) {
  return createAccountSessionManagementService({
    store,
    clock: { now: () => new Date(now) },
  });
}

function currentSessions(store: AccountServiceStore) {
  const accountSessions = createAccountSessionService({
    store,
    clock: { now: () => new Date(now) },
    tokenGenerator: { generate: () => canonicalToken("unused") },
    tokenHasher: sha256TokenHasher,
    sessionDurationMs: 60_000,
  });
  return createCurrentAccountSessionService({ accountSessions });
}

async function createOwner(
  label: string,
  status: AccountStatus = AccountStatus.ACTIVE
) {
  sequence += 1;
  const client = await db.client.create({
    data: {
      name: `${runId}_${sequence}_${label}`,
      email: `${runId}_${sequence}_${label}@example.test`,
    },
  });
  const account = await db.account.create({
    data: {
      clientId: client.id,
      email: `${runId}_${sequence}_${label}_account@example.test`,
      passwordHash: "fixture-hash",
      status,
    },
  });
  const gallery = await db.gallery.create({
    data: {
      clientId: client.id,
      title: `${runId}_${label}`,
      slug: `${runId}_${sequence}_${label}`,
      accessToken: `${runId}_${sequence}_${label}_gallery_token`,
      status: GalleryStatus.PROOFING,
      selectionLimit: 1,
    },
  });
  const photo = await db.photo.create({
    data: {
      galleryId: gallery.id,
      filename: `${label}.jpg`,
      baseName: `${label}_${sequence}`,
      thumbPath: `${label}.jpg`,
    },
  });
  const selection = await db.selection.create({
    data: {
      galleryId: gallery.id,
      photoId: photo.id,
      selected: false,
    },
  });
  return { client, account, gallery, photo, selection };
}

async function persistSession(input: {
  accountId: string;
  label: string;
  createdAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date | null;
}) {
  sessionSequence += 1;
  const token = canonicalToken(
    `${runId}_${sequence}_${input.label}_${sessionSequence}`
  );
  const session = await db.accountSession.create({
    data: {
      accountId: input.accountId,
      tokenHash: sha256TokenHasher.digest(token),
      createdAt:
        input.createdAt ?? new Date(now.getTime() - 5 * 60_000),
      expiresAt:
        input.expiresAt ?? new Date(now.getTime() + 60_000),
      revokedAt: input.revokedAt ?? null,
    },
  });
  return { token, session };
}

function principal(
  owner: Awaited<ReturnType<typeof createOwner>>,
  sessionId: string
) {
  return {
    sessionId,
    accountId: owner.account.id,
    clientId: owner.client.id,
    email: owner.account.email,
  };
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
  const residualSessions = await db.accountSession.count({
    where: { account: { client: { name: { startsWith: runId } } } },
  });
  expect({ residualClients, residualSessions }).toEqual({
    residualClients: 0,
    residualSessions: 0,
  });
  await Promise.all([
    connectionA.$disconnect(),
    connectionB.$disconnect(),
    connectionC.$disconnect(),
    db.$disconnect(),
  ]);
});

describe("active account session SQL isolation", () => {
  it("filters account, revocation, and expiry in PostgreSQL with deterministic ordering", async () => {
    const ownerA = await createOwner("list_a");
    const ownerB = await createOwner("list_b");
    const current = await persistSession({
      accountId: ownerA.account.id,
      label: "current",
      createdAt: new Date(now.getTime() - 10 * 60_000),
    });
    const sameTime = new Date(now.getTime() - 2 * 60_000);
    const otherA = await persistSession({
      accountId: ownerA.account.id,
      label: "other_a",
      createdAt: sameTime,
    });
    const otherB = await persistSession({
      accountId: ownerA.account.id,
      label: "other_b",
      createdAt: sameTime,
    });
    const revoked = await persistSession({
      accountId: ownerA.account.id,
      label: "revoked",
      revokedAt: new Date(now.getTime() - 1),
    });
    const expired = await persistSession({
      accountId: ownerA.account.id,
      label: "expired",
      expiresAt: new Date(now.getTime() - 1),
    });
    const foreign = await persistSession({
      accountId: ownerB.account.id,
      label: "foreign",
    });

    const sessions = await management(
      createPrismaAccountSessionManagementStore()
    ).list(principal(ownerA, current.session.id));
    const tiedIds = [otherA.session.id, otherB.session.id].sort();

    expect(sessions.map((session) => session.id)).toEqual([
      current.session.id,
      ...tiedIds,
    ]);
    expect(sessions.map((session) => session.current)).toEqual([
      true,
      false,
      false,
    ]);
    expect(sessions.flatMap((session) => Object.keys(session)).sort()).toEqual(
      [
        "createdAt",
        "createdAt",
        "createdAt",
        "current",
        "current",
        "current",
        "expiresAt",
        "expiresAt",
        "expiresAt",
        "id",
        "id",
        "id",
      ]
    );
    expect(JSON.stringify(sessions)).not.toMatch(
      /token|digest|passwordHash|accessToken/
    );
    expect(sessions.map((session) => session.id)).not.toEqual(
      expect.arrayContaining([
        revoked.session.id,
        expired.session.id,
        foreign.session.id,
      ])
    );
  });

  it("revokes only an owned usable session with homogeneous retry and foreign outcomes", async () => {
    const ownerA = await createOwner("revoke_a");
    const ownerB = await createOwner("revoke_b");
    const current = await persistSession({
      accountId: ownerA.account.id,
      label: "current",
    });
    const target = await persistSession({
      accountId: ownerA.account.id,
      label: "target",
    });
    const foreign = await persistSession({
      accountId: ownerB.account.id,
      label: "foreign",
    });
    const expired = await persistSession({
      accountId: ownerA.account.id,
      label: "expired",
      expiresAt: new Date(now.getTime() - 1),
    });
    const alreadyRevokedAt = new Date(now.getTime() - 5_000);
    const revoked = await persistSession({
      accountId: ownerA.account.id,
      label: "revoked",
      revokedAt: alreadyRevokedAt,
    });
    const service = management(
      createPrismaAccountSessionManagementStore()
    );
    const actor = principal(ownerA, current.session.id);

    await expect(
      service.revokeOwned(actor, target.session.id)
    ).resolves.toEqual({ revoked: true });
    await expect(
      service.revokeOwned(actor, target.session.id)
    ).resolves.toEqual({ revoked: false });
    await expect(
      service.revokeOwned(actor, foreign.session.id)
    ).resolves.toEqual({ revoked: false });
    await expect(
      service.revokeOwned(actor, expired.session.id)
    ).resolves.toEqual({ revoked: false });
    await expect(
      service.revokeOwned(actor, revoked.session.id)
    ).resolves.toEqual({ revoked: false });
    await expect(
      service.revokeOwned(actor, "c000000000000000000000000")
    ).resolves.toEqual({ revoked: false });

    expect(
      await db.accountSession.findUniqueOrThrow({
        where: { id: target.session.id },
      })
    ).toMatchObject({ revokedAt: now });
    expect(
      await db.accountSession.findUniqueOrThrow({
        where: { id: foreign.session.id },
      })
    ).toMatchObject({ revokedAt: null });
    expect(
      await db.accountSession.findUniqueOrThrow({
        where: { id: revoked.session.id },
      })
    ).toMatchObject({ revokedAt: alreadyRevokedAt });
  });

  it("rolls back a locked revocation when the transaction fails", async () => {
    const owner = await createOwner("rollback");
    const current = await persistSession({
      accountId: owner.account.id,
      label: "current",
    });
    const target = await persistSession({
      accountId: owner.account.id,
      label: "target",
    });
    const store = createPrismaAccountSessionManagementStore();

    await expect(
      store.transaction(async (transaction) => {
        await transaction.lockAccountById(owner.account.id);
        await transaction.lockSessionByIdForAccount(
          target.session.id,
          owner.account.id
        );
        await transaction.revokeSession(target.session.id, now);
        throw new Error("forced rollback");
      })
    ).rejects.toThrow("forced rollback");

    expect(
      await db.accountSession.findUniqueOrThrow({
        where: { id: target.session.id },
      })
    ).toMatchObject({ revokedAt: null });
    expect(current.session.revokedAt).toBeNull();
  });

  it("keeps public gallery access and selection data independent from account revocation", async () => {
    const owner = await createOwner("public_contract");
    const current = await persistSession({
      accountId: owner.account.id,
      label: "current",
    });
    const target = await persistSession({
      accountId: owner.account.id,
      label: "target",
    });
    const service = management(
      createPrismaAccountSessionManagementStore()
    );
    const galleryToken = owner.gallery.accessToken;

    await service.revokeOwned(
      principal(owner, current.session.id),
      target.session.id
    );

    const publicPage = await PrivateGalleryPage({
      params: Promise.resolve({ token: galleryToken }),
    });
    expect(publicPage.props.token).toBe(galleryToken);
    await updateSelectionFromClient(galleryToken, {
      photoId: owner.photo.id,
      selected: true,
    });

    expect(
      await galleryRepository.findByToken(galleryToken)
    ).toMatchObject({
      id: owner.gallery.id,
      accessToken: galleryToken,
    });
    expect(
      await db.selection.findUniqueOrThrow({
        where: { id: owner.selection.id },
      })
    ).toMatchObject({ selected: true });
    expect(
      await db.accountSession.findMany({
        where: { accountId: owner.account.id },
        select: { id: true },
      })
    ).toHaveLength(2);
  });
});

describe("account session management races on independent connections", () => {
  it("serializes two revocations of the same session", async () => {
    const owner = await createOwner("same_target_race");
    const current = await persistSession({
      accountId: owner.account.id,
      label: "current",
    });
    const target = await persistSession({
      accountId: owner.account.id,
      label: "target",
    });
    const actor = principal(owner, current.session.id);
    const serviceA = management(
      createPrismaAccountSessionManagementStore(connectionA)
    );
    const serviceB = management(
      createPrismaAccountSessionManagementStore(connectionB)
    );

    const results = await Promise.all([
      serviceA.revokeOwned(actor, target.session.id),
      serviceB.revokeOwned(actor, target.session.id),
    ]);

    expect(results.map((result) => result.revoked).sort()).toEqual([
      false,
      true,
    ]);
    expect(
      await db.accountSession.findUniqueOrThrow({
        where: { id: target.session.id },
      })
    ).toMatchObject({ revokedAt: now });
  });

  it("linearizes ID revocation while the same session resolves", async () => {
    const owner = await createOwner("resolve_race");
    const current = await persistSession({
      accountId: owner.account.id,
      label: "current",
    });
    const actor = principal(owner, current.session.id);
    const managementA = management(
      createPrismaAccountSessionManagementStore(connectionA)
    );
    const resolverB = currentSessions(
      createPrismaAccountServiceStore(connectionB)
    );

    const [resolution] = await Promise.all([
      resolverB.resolve(current.token),
      managementA.revokeOwned(actor, current.session.id),
    ]);

    expect(["authenticated", "unauthenticated"]).toContain(
      resolution.kind
    );
    await expect(
      resolverB.resolve(current.token)
    ).resolves.toEqual({ kind: "unauthenticated" });
  });

  it("does not lock or revoke a foreign owner session while it resolves", async () => {
    const attacker = await createOwner("foreign_attacker");
    const owner = await createOwner("foreign_owner");
    const attackerCurrent = await persistSession({
      accountId: attacker.account.id,
      label: "attacker_current",
    });
    const ownerCurrent = await persistSession({
      accountId: owner.account.id,
      label: "owner_current",
    });
    const managementA = management(
      createPrismaAccountSessionManagementStore(connectionA)
    );
    const resolverB = currentSessions(
      createPrismaAccountServiceStore(connectionB)
    );

    const [revokeResult, resolution] = await Promise.all([
      managementA.revokeOwned(
        principal(attacker, attackerCurrent.session.id),
        ownerCurrent.session.id
      ),
      resolverB.resolve(ownerCurrent.token),
    ]);

    expect(revokeResult).toEqual({ revoked: false });
    expect(resolution).toMatchObject({
      kind: "authenticated",
      principal: { accountId: owner.account.id },
    });
    expect(
      await db.accountSession.findUniqueOrThrow({
        where: { id: ownerCurrent.session.id },
      })
    ).toMatchObject({ revokedAt: null });
  });

  it("serializes canonical logout with ID revocation of the current session", async () => {
    const owner = await createOwner("logout_id_race");
    const current = await persistSession({
      accountId: owner.account.id,
      label: "current",
    });
    const logoutA = currentSessions(
      createPrismaAccountServiceStore(connectionA)
    );
    const managementB = management(
      createPrismaAccountSessionManagementStore(connectionB)
    );

    await expect(
      Promise.all([
        logoutA.logout(current.token),
        managementB.revokeOwned(
          principal(owner, current.session.id),
          current.session.id
        ),
      ])
    ).resolves.toEqual([
      undefined,
      expect.objectContaining({ revoked: expect.any(Boolean) }),
    ]);
    expect(
      await db.accountSession.findUniqueOrThrow({
        where: { id: current.session.id },
      })
    ).toMatchObject({ revokedAt: now });
  });

  it("allows a concurrent list snapshot while revocation removes the next snapshot", async () => {
    const owner = await createOwner("list_revoke_race");
    const current = await persistSession({
      accountId: owner.account.id,
      label: "current",
    });
    const target = await persistSession({
      accountId: owner.account.id,
      label: "target",
    });
    const revoked = await persistSession({
      accountId: owner.account.id,
      label: "already_revoked",
      revokedAt: new Date(now.getTime() - 1),
    });
    const expired = await persistSession({
      accountId: owner.account.id,
      label: "expired",
      expiresAt: new Date(now.getTime() - 1),
    });
    const actor = principal(owner, current.session.id);
    const serviceA = management(
      createPrismaAccountSessionManagementStore(connectionA)
    );
    const serviceB = management(
      createPrismaAccountSessionManagementStore(connectionB)
    );

    const [snapshot] = await Promise.all([
      serviceA.list(actor),
      serviceB.revokeOwned(actor, target.session.id),
    ]);
    const disallowed = [revoked.session.id, expired.session.id];

    expect(snapshot[0]).toMatchObject({
      id: current.session.id,
      current: true,
    });
    expect(snapshot.map((session) => session.id)).not.toEqual(
      expect.arrayContaining(disallowed)
    );
    await expect(serviceA.list(actor)).resolves.toEqual([
      expect.objectContaining({
        id: current.session.id,
        current: true,
      }),
    ]);
  });

  it("keeps a disabled account unauthenticated before any management operation", async () => {
    const owner = await createOwner(
      "disabled",
      AccountStatus.DISABLED
    );
    const current = await persistSession({
      accountId: owner.account.id,
      label: "current",
    });
    const resolver = currentSessions(
      createPrismaAccountServiceStore(connectionC)
    );

    await expect(
      resolver.resolve(current.token)
    ).resolves.toEqual({ kind: "unauthenticated" });
  });
});
