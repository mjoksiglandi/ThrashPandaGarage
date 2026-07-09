import { NextResponse } from "next/server";
import { confirmSelection } from "@/modules/selections/selection.service";

export async function POST(_: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    await confirmSelection(token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}
