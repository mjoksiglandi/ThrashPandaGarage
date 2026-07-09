import nodemailer from "nodemailer";
import { GalleryStatus } from "@prisma/client";
import { env } from "@/lib/env";
import { galleryRepository } from "@/modules/galleries/gallery.repository";

export function galleryEmailText(clientName: string, galleryUrl: string) {
  return `Hola, ${clientName}.

Tu galeria de seleccion ya esta disponible:

${galleryUrl}

Puedes revisar las fotos, marcar tus favoritas y dejar comentarios si necesitas indicar algo especifico.

Cuando termines, presiona "Confirmar seleccion" para que pueda avanzar con la edicion final.

Gracias por confiar en Trashpanda Garage.

- Gormm`;
}

export async function sendGalleryEmail(galleryId: string) {
  const gallery = await galleryRepository.find(galleryId);
  if (!gallery?.client.email) throw new Error("Gallery client email is required");

  const galleryUrl = `${env.APP_BASE_URL}/g/${gallery.accessToken}`;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  await transport.sendMail({
    from: env.MAIL_FROM,
    to: gallery.client.email,
    subject: "Tu galeria esta lista - Trashpanda Garage",
    text: galleryEmailText(gallery.client.name, galleryUrl),
  });

  await galleryRepository.update(galleryId, { status: GalleryStatus.EMAIL_SENT, emailSentAt: new Date() });
  await galleryRepository.event(galleryId, "EMAIL_SENT", { to: gallery.client.email });
}
