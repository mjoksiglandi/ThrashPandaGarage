export function ExportSelectionButton({ galleryId }: { galleryId: string }) {
  return (
    <div className="grid gap-2">
      <a className="button secondary text-center" href={`/admin/galleries/${galleryId}/export`}>
        Exportar seleccion TXT
      </a>
      <a className="button secondary text-center" href={`/admin/galleries/${galleryId}/export/csv`}>
        Exportar seleccion CSV
      </a>
    </div>
  );
}
