import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { exportSelectionText } from "@/modules/selections/selection.service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const text = await exportSelectionText(id);
  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="selection-${id}.txt"`,
    },
  });
}
