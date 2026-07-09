import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { exportSelectionCsv } from "@/modules/selections/selection.service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const csv = await exportSelectionCsv(id);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="selection-${id}.csv"`,
    },
  });
}
