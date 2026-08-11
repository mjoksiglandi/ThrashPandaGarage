import type { GalleryStatus } from "@prisma/client";

export const portalGalleryStatusLabels: Record<GalleryStatus, string> = {
  DRAFT: "Cerrada",
  EMAIL_SENT: "Cerrada",
  PROOFING: "Seleccionando",
  SELECTION_CONFIRMED: "Selección enviada",
  EDITING: "Selección enviada",
  READY_FOR_DELIVERY: "Lista para entrega",
  DELIVERED: "Entregada",
  ARCHIVED: "Cerrada",
};
