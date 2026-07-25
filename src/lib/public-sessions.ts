import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { getPhotoStorageRoot } from "@/modules/storage/storage.service";

const IMAGE_EXTENSIONS = new Set([".webp"]);

function sessionsRoot() {
  return path.join(getPhotoStorageRoot(), "sessions");
}

export type PublicSession = {
  slug: string;
  name: string;
  description: string;
  category?: string;
  date?: string;
  cover: string;
  images: string[];
  order: number;
};

function parseSessionMarkdown(source: string) {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const metadata: Record<string, string> = {};
  let description = normalized.trim();

  if (match) {
    for (const line of match[1].split("\n")) {
      const separator = line.indexOf(":");
      if (separator === -1) continue;
      const key = line.slice(0, separator).trim().toLowerCase();
      const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
      metadata[key] = value;
    }
    description = match[2].trim();
  }

  return { metadata, description };
}

async function imageFiles(directory: string) {
  try {
    return (await fs.readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch {
    return [];
  }
}

function publicImagePath(slug: string, folder: "cover" | "content", filename: string) {
  return `/api/public-sessions/${encodeURIComponent(slug)}/${folder}/${encodeURIComponent(filename)}`;
}

async function loadSession(slug: string): Promise<PublicSession | null> {
  const sessionDirectory = path.join(sessionsRoot(), slug);

  try {
    const markdown = await fs.readFile(path.join(sessionDirectory, "session.md"), "utf8");
    const { metadata, description } = parseSessionMarkdown(markdown);
    if (metadata.published?.toLowerCase() === "false") return null;

    const [covers, content] = await Promise.all([
      imageFiles(path.join(sessionDirectory, "cover")),
      imageFiles(path.join(sessionDirectory, "content")),
    ]);
    if (content.length === 0) return null;

    const requestedCover = metadata.cover;
    const coverFile = requestedCover && covers.includes(requestedCover) ? requestedCover : covers[0];
    const cover = coverFile
      ? publicImagePath(slug, "cover", coverFile)
      : publicImagePath(slug, "content", content[0]);

    return {
      slug,
      name: metadata.name || slug.replace(/[-_]+/g, " "),
      description,
      category: metadata.category || undefined,
      date: metadata.date || undefined,
      cover,
      images: content.map((filename) => publicImagePath(slug, "content", filename)),
      order: Number.isFinite(Number(metadata.order)) ? Number(metadata.order) : 999,
    };
  } catch {
    return null;
  }
}

export async function getPublicSessions() {
  try {
    const folders = (await fs.readdir(sessionsRoot(), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
      .map((entry) => entry.name);
    const sessions = (await Promise.all(folders.map(loadSession))).filter(
      (session): session is PublicSession => session !== null,
    );
    return sessions.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function getPublicSession(slug: string) {
  if (!slug || slug.includes("/") || slug.includes("\\") || slug.startsWith(".")) return null;
  return loadSession(slug);
}
