export function SendGalleryEmailButton({ onSend }: { onSend: () => Promise<void> }) {
  return (
    <form action={onSend}>
      <button className="secondary w-full" type="submit">Enviar correo</button>
    </form>
  );
}
