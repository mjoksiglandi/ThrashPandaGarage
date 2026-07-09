import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { photoRepository } from "@/modules/photos/photo.repository";
import { resolveStoragePath } from "@/modules/storage/storage.service";

const contentTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await photoRepository.find(id);
  if (!photo) return new NextResponse("Not found", { status: 404 });

  const variant = request.nextUrl.searchParams.get("variant") === "preview" ? "preview" : "thumb";
  const relativePath = variant === "preview" ? photo.previewPath || photo.thumbPath : photo.thumbPath;
  const extension = path.extname(relativePath).replace(".", "").toLowerCase();
  if (!contentTypes[extension]) return new NextResponse("Unsupported", { status: 400 });

  const file = await fs.readFile(resolveStoragePath(relativePath));
  return new NextResponse(file, {
    headers: {
      "Content-Type": contentTypes[extension],
      "Cache-Control": "private, max-age=3600",
    },
  });
}
