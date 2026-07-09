import fs from "fs/promises";
import path from "path";
import { env } from "@/lib/env";
import { supportedImageExtensions } from "@/lib/validators";
import type { StoredPhotoFile } from "./storage.types";

function safeJoin(root: string, ...segments: string[]) {
  const resolved = path.resolve(root, ...segments);
  const base = path.resolve(root);
  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) {
    throw new Error("Invalid photo path");
  }
  return resolved;
}

export function getPhotoStorageRoot() {
  return env.PHOTO_STORAGE_ROOT;
}

export function resolveStoragePath(relativePath: string) {
  return safeJoin(getPhotoStorageRoot(), relativePath);
}

export function buildRelativePhotoPath(...segments: string[]) {
  const clean = segments.map((segment) => segment.replaceAll("\\", "/").replace(/^\/+/, ""));
  const joined = path.posix.join(...clean);
  if (joined.includes("..")) throw new Error("Invalid relative path");
  return joined;
}

export async function listImageFiles(relativeFolder: string): Promise<StoredPhotoFile[]> {
  const folderPath = resolveStoragePath(relativeFolder);
  const entries = await fs.readdir(folderPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const extension = path.extname(entry.name).replace(".", "").toLowerCase();
      if (!supportedImageExtensions.has(extension)) return null;
      const baseName = path.basename(entry.name, path.extname(entry.name));
      return {
        filename: entry.name,
        baseName,
        relativePath: buildRelativePhotoPath(relativeFolder, entry.name),
      };
    })
    .filter((entry): entry is StoredPhotoFile => entry !== null)
    .sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
}
