export function SelectionCounter({
  selectedCount,
  selectionLimit,
}: {
  selectedCount: number;
  selectionLimit?: number | null;
}) {
  return (
    <strong>
      {selectedCount}
      {selectionLimit ? ` / ${selectionLimit}` : ""} seleccionadas
    </strong>
  );
}
