import type { GalleryStatus } from "@prisma/client";
import { AdminStatusChip, type AdminStatusTone } from "./AdminStatusChip";

export const galleryStatusLabels: Record<GalleryStatus, string> = {
  DRAFT: "Borrador",
  EMAIL_SENT: "Correo enviado",
  PROOFING: "En revision",
  SELECTION_CONFIRMED: "Seleccion confirmada",
  EDITING: "En edicion",
  READY_FOR_DELIVERY: "Lista para entrega",
  DELIVERED: "Entregada",
  ARCHIVED: "Archivada",
};

const tones: Record<GalleryStatus, AdminStatusTone> = {
  DRAFT: "neutral",
  EMAIL_SENT: "blue",
  PROOFING: "blue",
  SELECTION_CONFIRMED: "violet",
  EDITING: "amber",
  READY_FOR_DELIVERY: "green",
  DELIVERED: "green",
  ARCHIVED: "neutral",
};

export function GalleryStatusBadge({ status }: { status: GalleryStatus }) {
  return <AdminStatusChip tone={tones[status]}>{galleryStatusLabels[status]}</AdminStatusChip>;
}
