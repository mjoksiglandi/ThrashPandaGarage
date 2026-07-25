import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { buildRelativePhotoPath, resolveStoragePath } from "@/modules/storage/storage.service";

type ImageRouteProps = {
  params: Promise<{ slug: string; folder: string; filename: string }>;
};

export async function GET(_request: Request, { params }: ImageRouteProps) {
  const { slug, folder, filename } = await params;
  if (!/^[a-zA-Z0-9_-]+$/.test(slug) || !["cover", "content"].includes(folder) || path.extname(filename).toLowerCase() !== ".webp") {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const relativePath = buildRelativePhotoPath("sessions", slug, folder, filename);
    const image = await fs.readFile(resolveStoragePath(relativePath));
    return new NextResponse(image, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
