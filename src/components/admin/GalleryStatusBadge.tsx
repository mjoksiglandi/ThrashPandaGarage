import type { GalleryStatus } from "@prisma/client";

const labels: Record<GalleryStatus, string> = {
  DRAFT: "Borrador",
  EMAIL_SENT: "Correo enviado",
  PROOFING: "Seleccion",
  SELECTION_CONFIRMED: "Confirmada",
  EDITING: "Editando",
  READY_FOR_DELIVERY: "Lista",
  DELIVERED: "Entregada",
  ARCHIVED: "Archivada",
};

export function GalleryStatusBadge({ status }: { status: GalleryStatus }) {
  return (
    <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200">
      {labels[status]}
    </span>
  );
}
