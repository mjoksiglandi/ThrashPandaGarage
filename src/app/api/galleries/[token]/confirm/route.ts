import { NextResponse } from "next/server";
import { galleryErrorMessage, galleryErrorStatus } from "@/modules/galleries/gallery-http";
import { confirmSelection } from "@/modules/selections/selection.service";

export async function POST(_: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const result = await confirmSelection(token);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: galleryErrorMessage(error) },
      { status: galleryErrorStatus(error) }
    );
  }
}
