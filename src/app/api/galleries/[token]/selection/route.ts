import { NextRequest, NextResponse } from "next/server";
import { updateSelectionFromClient } from "@/modules/selections/selection.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await request.json();
    await updateSelectionFromClient(token, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}
