import { NextResponse } from "next/server";
import {
  GalleryNotFoundError,
  GalleryUnavailableError,
  SelectionClosedError,
  SelectionCountMismatchError,
} from "@/modules/galleries/gallery.errors";
import { authorizePortalGallery } from "@/modules/portal/portal-access";
import { confirmPortalSelection } from "@/modules/portal/portal-selection.service";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ galleryId: string }> }
) {
  const { galleryId } = await params;
  const authorized = await authorizePortalGallery(galleryId);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  try {
    const result = await confirmPortalSelection(
      authorized.gallery.id,
      authorized.actor
    );
    return NextResponse.json({ ok: true, ...result });
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
