export function parseGalleryAccessCode(input: string): string {
  const value = input.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/g\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : "";
  } catch {
    return value;
  }
}
