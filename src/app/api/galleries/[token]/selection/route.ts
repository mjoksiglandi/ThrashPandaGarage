import { NextRequest, NextResponse } from "next/server";
import { galleryErrorMessage, galleryErrorStatus } from "@/modules/galleries/gallery-http";
import { updateSelectionFromClient } from "@/modules/selections/selection.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400 }
      );
    }
    await updateSelectionFromClient(token, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: galleryErrorMessage(error) },
      { status: galleryErrorStatus(error) }
    );
  }
}
