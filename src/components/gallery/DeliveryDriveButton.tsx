export function DeliveryDriveButton({ url }: { url: string }) {
  return (
    <a className="button" href={url} target="_blank" rel="noreferrer">
      Abrir entrega Drive
    </a>
  );
}
