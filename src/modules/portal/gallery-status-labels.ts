import type { GalleryStatus } from "@prisma/client";

export const portalGalleryStatusLabels: Record<GalleryStatus, string> = {
  DRAFT: "Preparación",
  EMAIL_SENT: "Invitación enviada",
  PROOFING: "Selección abierta",
  SELECTION_CONFIRMED: "Selección confirmada",
  EDITING: "En edición",
  READY_FOR_DELIVERY: "Lista para entrega",
  DELIVERED: "Entregada",
  ARCHIVED: "Archivada",
};
