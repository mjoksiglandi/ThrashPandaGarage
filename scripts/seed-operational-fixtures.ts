import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { AccountStatus, GalleryStatus, PhotoStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createMailTransport } from "@/modules/mail/mail-transport";
import { passwordRecoveryUrl } from "@/modules/mail/password-recovery-mail";
import { accountInvitationUrl } from "@/modules/mail/account-invitation-mail";
import { buildRelativePhotoPath, resolveStoragePath } from "@/modules/storage/storage.service";

const fixture = {
  clientAId: "dev-client-demo-a",
  galleryAId: "dev-gallery-session-demo-a",
  galleryAToken: "dev-gallery-token-a-000000000000000000000",
  clientBId: "dev-client-security-b",
  accountBId: "dev-account-security-b",
  galleryBId: "dev-gallery-security-b",
  galleryBToken: "dev-gallery-token-b-000000000000000000000",
  closedGalleryId: "dev-gallery-closed-a",
  closedGalleryToken: "dev-gallery-token-closed-0000000000000000",
  expiredGalleryId: "dev-gallery-expired-a",
  expiredGalleryToken: "dev-gallery-token-expired-000000000000000",
  expiredInvitationClientId: "dev-client-expired-invitation",
  expiredInvitationAccountId: "dev-account-expired-invitation",
  expiredInvitationId: "dev-invitation-expired",
  expiredRecoveryClientId: "dev-client-expired-recovery",
  expiredRecoveryAccountId: "dev-account-expired-recovery",
  expiredRecoveryId: "dev-recovery-expired",
} as const;

const demoEmail = "cliente.demo@trashpanda.test";
const accountBEmail = "cliente.b@trashpanda.test";
const expiredInvitationEmail = "invitacion.expirada@trashpanda.test";
const expiredRecoveryEmail = "recovery.expirado@trashpanda.test";
const fixturePassword = process.env.DEV_FIXTURE_PASSWORD ?? "DemoCliente!2026";
const expiredInvitationToken = Buffer.alloc(32, 17).toString("base64url");
const expiredRecoveryToken = Buffer.alloc(32, 29).toString("base64url");

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function assertDevelopmentTarget() {
  const appUrl = new URL(env.APP_BASE_URL);
  const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
  const localHosts = new Set(["localhost", "127.0.0.1", "db"]);

  if (
    process.env.NODE_ENV === "production" ||
    !localHosts.has(appUrl.hostname) ||
    !databaseUrl ||
    !localHosts.has(databaseUrl.hostname)
  ) {
    throw new Error("Operational fixtures are restricted to the local development environment");
  }
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for the operational fixture");
  }
}

async function copyFixturePhotos() {
  const sourceRoot = path.resolve(process.cwd(), "public");
  const sources = [
    ...(await fs.readdir(path.join(sourceRoot, "hero"))).map((name) => path.join(sourceRoot, "hero", name)),
    ...(await fs.readdir(path.join(sourceRoot, "photos"))).map((name) => path.join(sourceRoot, "photos", name)),
  ]
    .filter((name) => path.extname(name).toLowerCase() === ".webp")
    .sort()
    .slice(0, 20);

  if (sources.length !== 20) {
    throw new Error(`Expected 20 repository fixture photos, found ${sources.length}`);
  }

  const relativeThumbFolder = buildRelativePhotoPath("dev-fixtures", "session-demo", "thumbs");
  const relativePreviewFolder = buildRelativePhotoPath("dev-fixtures", "session-demo", "preview");
  await Promise.all([
    fs.mkdir(resolveStoragePath(relativeThumbFolder), { recursive: true }),
    fs.mkdir(resolveStoragePath(relativePreviewFolder), { recursive: true }),
  ]);

  const photos = await Promise.all(
    sources.map(async (source, index) => {
      const filename = `DEMO_${String(index + 1).padStart(2, "0")}.webp`;
      const thumbPath = buildRelativePhotoPath(relativeThumbFolder, filename);
      const previewPath = buildRelativePhotoPath(relativePreviewFolder, filename);
      await Promise.all([
        fs.copyFile(source, resolveStoragePath(thumbPath)),
        fs.copyFile(source, resolveStoragePath(previewPath)),
      ]);
      return { filename, baseName: path.parse(filename).name, thumbPath, previewPath, sortOrder: index };
    })
  );

  return { photos, relativeThumbFolder, relativePreviewFolder };
}

async function sendExpiredLinkMessages() {
  if (!env.SMTP_HOST) {
    console.warn("SMTP_HOST is empty; expired-link messages were not sent to the development mailbox.");
    return;
  }

  const transport = createMailTransport();
  await Promise.all([
    transport.sendMail({
      from: env.MAIL_FROM,
      to: expiredInvitationEmail,
      subject: "[Fixture] Invitación expirada",
      text: `Este enlace está expirado y debe mostrar un resultado público genérico:\n\n${accountInvitationUrl(env.APP_BASE_URL, expiredInvitationToken)}`,
    }),
    transport.sendMail({
      from: env.MAIL_FROM,
      to: expiredRecoveryEmail,
      subject: "[Fixture] Recovery expirado",
      text: `Este enlace está expirado y no debe permitir cambiar la contraseña:\n\n${passwordRecoveryUrl(env.APP_BASE_URL, expiredRecoveryToken)}`,
    }),
    transport.sendMail({
      from: env.MAIL_FROM,
      to: demoEmail,
      subject: "[Fixture] Token de galería expirado",
      text: `Esta galería expirada no debe abrir:\n\n${env.APP_BASE_URL}/g/${fixture.expiredGalleryToken}`,
    }),
  ]);
}

async function main() {
  assertDevelopmentTarget();
  const { photos, relativeThumbFolder, relativePreviewFolder } = await copyFixturePhotos();
  const [adminPasswordHash, fixturePasswordHash] = await Promise.all([
    bcrypt.hash(env.ADMIN_PASSWORD!, 12),
    bcrypt.hash(fixturePassword, 12),
  ]);
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const expiredCreatedAt = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

  await db.$transaction(async (tx) => {
    await tx.client.deleteMany({
      where: {
        id: {
          in: [
            fixture.clientAId,
            fixture.clientBId,
            fixture.expiredInvitationClientId,
            fixture.expiredRecoveryClientId,
          ],
        },
      },
    });

    await tx.user.upsert({
      where: { email: env.ADMIN_EMAIL! },
      update: { passwordHash: adminPasswordHash, role: UserRole.ADMIN },
      create: {
        email: env.ADMIN_EMAIL!,
        name: "Admin Fixture",
        passwordHash: adminPasswordHash,
        role: UserRole.ADMIN,
      },
    });

    await tx.client.create({
      data: {
        id: fixture.clientAId,
        name: "Cliente Demo",
        email: demoEmail,
        notes: "Fixture PR 17. La cuenta se crea desde el navegador en el Flujo B.",
        galleries: {
          create: [
            {
              id: fixture.galleryAId,
              title: "Sesión Demo",
              slug: "sesion-demo",
              accessToken: fixture.galleryAToken,
              status: GalleryStatus.PROOFING,
              selectionLimit: 8,
              expiresAt: future,
              emailSentAt: now,
              thumbnailLocalPath: relativeThumbFolder,
              previewLocalPath: relativePreviewFolder,
              photos: {
                create: photos.map((photo, index) => ({
                  id: `dev-photo-a-${String(index + 1).padStart(2, "0")}`,
                  ...photo,
                  status: PhotoStatus.PROOF,
                })),
              },
              events: {
                create: {
                  type: "DEV_FIXTURE_CREATED",
                  actorType: "SYSTEM",
                  metadata: { fixture: "pr17-operational" },
                },
              },
            },
            {
              id: fixture.closedGalleryId,
              title: "Sesión Cerrada",
              slug: "sesion-cerrada",
              accessToken: fixture.closedGalleryToken,
              status: GalleryStatus.ARCHIVED,
              selectionLimit: 1,
              thumbnailLocalPath: relativeThumbFolder,
              previewLocalPath: relativePreviewFolder,
              photos: {
                create: {
                  id: "dev-photo-closed-01",
                  ...photos[0],
                  status: PhotoStatus.PROOF,
                },
              },
            },
            {
              id: fixture.expiredGalleryId,
              title: "Sesión Token Expirado",
              slug: "sesion-token-expirado",
              accessToken: fixture.expiredGalleryToken,
              status: GalleryStatus.PROOFING,
              selectionLimit: 1,
              expiresAt: past,
              thumbnailLocalPath: relativeThumbFolder,
              previewLocalPath: relativePreviewFolder,
              photos: {
                create: {
                  id: "dev-photo-expired-01",
                  ...photos[1],
                  status: PhotoStatus.PROOF,
                },
              },
            },
          ],
        },
      },
    });

    await tx.client.create({
      data: {
        id: fixture.clientBId,
        name: "Cliente Seguridad B",
        email: accountBEmail,
        account: {
          create: {
            id: fixture.accountBId,
            email: accountBEmail,
            status: AccountStatus.ACTIVE,
            passwordHash: fixturePasswordHash,
          },
        },
        galleries: {
          create: {
            id: fixture.galleryBId,
            title: "Galería Seguridad B",
            slug: "galeria-seguridad-b",
            accessToken: fixture.galleryBToken,
            status: GalleryStatus.PROOFING,
            selectionLimit: 1,
            expiresAt: future,
            thumbnailLocalPath: relativeThumbFolder,
            previewLocalPath: relativePreviewFolder,
            photos: {
              create: {
                id: "dev-photo-b-01",
                ...photos[2],
                status: PhotoStatus.PROOF,
              },
            },
          },
        },
      },
    });

    await tx.client.create({
      data: {
        id: fixture.expiredInvitationClientId,
        name: "Cliente Invitación Expirada",
        email: expiredInvitationEmail,
        account: {
          create: {
            id: fixture.expiredInvitationAccountId,
            email: expiredInvitationEmail,
            status: AccountStatus.INVITED,
            invitations: {
              create: {
                id: fixture.expiredInvitationId,
                tokenHash: tokenHash(expiredInvitationToken),
                expiresAt: past,
                createdAt: expiredCreatedAt,
                createdByActorId: "dev-fixture",
              },
            },
          },
        },
      },
    });

    await tx.client.create({
      data: {
        id: fixture.expiredRecoveryClientId,
        name: "Cliente Recovery Expirado",
        email: expiredRecoveryEmail,
        account: {
          create: {
            id: fixture.expiredRecoveryAccountId,
            email: expiredRecoveryEmail,
            status: AccountStatus.ACTIVE,
            passwordHash: fixturePasswordHash,
            passwordRecoveries: {
              create: {
                id: fixture.expiredRecoveryId,
                tokenHash: tokenHash(expiredRecoveryToken),
                expiresAt: past,
                createdAt: expiredCreatedAt,
              },
            },
          },
        },
      },
    });
  });

  await sendExpiredLinkMessages();

  console.log("Operational fixture ready");
  console.log(`Admin: ${env.ADMIN_EMAIL}`);
  console.log(`Client A: ${demoEmail} (sin cuenta; crear e invitar en Flujo B)`);
  console.log(`Gallery A: ${env.APP_BASE_URL}/g/${fixture.galleryAToken}`);
  console.log(`Client B: ${accountBEmail}`);
  console.log(`Fixture password: ${fixturePassword}`);
  console.log(`Mailpit: http://localhost:8025`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
