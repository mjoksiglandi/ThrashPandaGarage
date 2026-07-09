import type { Photo, Selection } from "@prisma/client";

type SelectionWithPhoto = Selection & { photo: Photo };

export function SelectedPhotoList({ selections }: { selections: SelectionWithPhoto[] }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-[#141417] p-4">
      <h2 className="font-bold">Seleccionadas</h2>
      <p className="mt-1 text-sm text-zinc-500">{selections.length} fotos</p>
      <ul className="mt-4 grid gap-2 text-sm">
        {selections.map((selection) => (
          <li key={selection.id} className="rounded border border-zinc-800 p-2">
            <strong>{selection.photo.baseName}</strong>
            {selection.comment && <p className="mt-1 text-zinc-400">{selection.comment}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
