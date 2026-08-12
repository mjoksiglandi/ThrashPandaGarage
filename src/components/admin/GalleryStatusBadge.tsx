import type { GalleryStatus } from "@prisma/client";

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

const colors: Record<GalleryStatus, string> = {
  DRAFT: "oklch(55% 0.01 260)",
  EMAIL_SENT: "oklch(62% 0.09 240)",
  PROOFING: "oklch(58% 0.11 300)",
  SELECTION_CONFIRMED: "oklch(72% 0.12 65)",
  EDITING: "oklch(42% 0.15 300)",
  READY_FOR_DELIVERY: "oklch(62% 0.09 165)",
  DELIVERED: "oklch(78% 0.04 145)",
  ARCHIVED: "oklch(42% 0.01 260)",
};

export function GalleryStatusBadge({ status }: { status: GalleryStatus }) {
  return (
    <span className="mono inline-flex items-center gap-2 rounded-[3px] border border-[var(--line-strong)] bg-white/[0.02] px-2.5 py-1.5 text-[11px] uppercase tracking-[0.06em] text-[#d8d6dd]">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: colors[status], boxShadow: `0 0 6px ${colors[status]}` }}
      />
      {galleryStatusLabels[status]}
    </span>
  );
}
