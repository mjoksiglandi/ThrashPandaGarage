"use client";

export function ConfirmSelectionButton({
  confirmed,
  pending,
  onConfirm,
}: {
  confirmed: boolean;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <button type="button" disabled={pending || confirmed} onClick={onConfirm}>
      {confirmed ? "Selección enviada" : "Confirmar selección"}
    </button>
  );
}
