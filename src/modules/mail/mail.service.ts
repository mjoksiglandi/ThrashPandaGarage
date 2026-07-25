import nodemailer from "nodemailer";
import { GalleryStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { GalleryNotFoundError } from "@/modules/galleries/gallery.errors";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import {
  assertCanResendInvitation,
  assertCanSendInitialInvitation,
} from "./mail-workflow";

export function galleryEmailText(clientName: string, galleryUrl: string) {
  return `Hola, ${clientName}.

Tu galería de selección ya está disponible:

${galleryUrl}

Puedes revisar las fotos, marcar tus favoritas y dejar comentarios si necesitas indicar algo específico.

Cuando termines, presiona "Confirmar selección" para que pueda avanzar con la edición final.

Gracias por confiar en Trashpanda Garage.

— Gormm`;
}

type GalleryInvitationInput = {
  galleryId: string;
  actorId: string;
};

type GalleryInvitationOperation = "initial" | "resend";

function assertActorId(actorId: string): void {
  if (!actorId.trim()) {
    throw new Error("Admin actorId is required");
  }
}

async function sendGalleryInvitation(
  { galleryId, actorId }: GalleryInvitationInput,
  operation: GalleryInvitationOperation
) {
  assertActorId(actorId);
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  return db.$transaction(
    async (tx) => {
      const gallery = await galleryRepository.findForInvitationForUpdate(galleryId, tx);
      if (!gallery) throw new GalleryNotFoundError();

      if (operation === "initial") {
        assertCanSendInitialInvitation(gallery.status);
      } else {
        assertCanResendInvitation(gallery.status);
      }
      if (!gallery.client.email) {
        throw new Error("Gallery client email is required");
      }

      const galleryUrl = `${env.APP_BASE_URL}/g/${gallery.accessToken}`;
      await transport.sendMail({
        from: env.MAIL_FROM,
        to: gallery.client.email,
        subject: "Tu galería está lista — Trashpanda Garage",
        text: galleryEmailText(gallery.client.name, galleryUrl),
      });

      const sentAt = new Date();
      const updated = await galleryRepository.update(
        galleryId,
        operation === "initial"
          ? { status: GalleryStatus.EMAIL_SENT, emailSentAt: sentAt }
          : { emailSentAt: sentAt },
        tx
      );
      await galleryRepository.event(
        {
          galleryId,
          type:
            operation === "initial"
              ? "GALLERY_EMAIL_SENT"
              : "GALLERY_EMAIL_RESENT",
          actorType: "ADMIN",
          actorId,
          metadata:
            operation === "initial"
              ? {
                  fromStatus: GalleryStatus.DRAFT,
                  toStatus: GalleryStatus.EMAIL_SENT,
                }
              : { status: gallery.status },
        },
        tx
      );
      return updated;
    },
    { timeout: 30_000 }
  );
}

export function sendInitialGalleryInvitation(input: GalleryInvitationInput) {
  return sendGalleryInvitation(input, "initial");
}

export function resendGalleryInvitation(input: GalleryInvitationInput) {
  return sendGalleryInvitation(input, "resend");
}
