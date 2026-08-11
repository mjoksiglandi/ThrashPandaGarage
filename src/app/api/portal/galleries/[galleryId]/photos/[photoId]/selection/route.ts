import { NextRequest, NextResponse } from "next/server";
import { portalSelectionSchema } from "@/lib/validators";
import {
  GalleryNotFoundError,
  GalleryUnavailableError,
  SelectionClosedError,
  SelectionCountMismatchError,
} from "@/modules/galleries/gallery.errors";
import { authorizePortalPhotoInGallery } from "@/modules/portal/portal-access";
import { setPortalPhotoSelection } from "@/modules/portal/portal-selection.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ galleryId: string; photoId: string }> }
) {
  const { galleryId, photoId } = await params;

  const authorized = await authorizePortalPhotoInGallery(galleryId, photoId);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = portalSelectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  try {
    const selection = await setPortalPhotoSelection(
      authorized.gallery.id,
      authorized.photo.id,
      parsed.data.selected,
      parsed.data.comment
    );
    return NextResponse.json({
      ok: true,
      selected: selection.selected,
      comment: selection.comment ?? "",
    });
  } catch (error) {
    if (error instanceof GalleryUnavailableError) {
      return NextResponse.json({ ok: false, error: "Gallery unavailable" }, { status: 410 });
    }
    if (
      error instanceof SelectionClosedError ||
      error instanceof SelectionCountMismatchError
    ) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    }
    if (error instanceof GalleryNotFoundError) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
