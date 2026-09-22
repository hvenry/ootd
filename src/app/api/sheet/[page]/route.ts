import { NextResponse } from "next/server";

import { buildA3SheetPdf, buildSheetPdf } from "@/lib/homography/sheet-pdf";
import { CORNER_IDS, isPaperSize, SHEET_VERSION } from "@/lib/homography/sheet";

export const runtime = "nodejs";

const CORNER_SLUGS = ["top-left", "top-right", "bottom-right", "bottom-left"];

/**
 * One marker page as a PDF, or `all` for the set. A PDF carries its own
 * physical page size, so "100%" means the same thing in every print dialogue.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page } = await params;

  const requested = new URL(request.url).searchParams.get("paper") ?? "a4";
  const paper = isPaperSize(requested) ? requested : "a4";

  let index: number | null;
  let filename: string;

  if (page === "a3") {
    const a3 = await buildA3SheetPdf();
    return new NextResponse(a3 as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ootd-sheet-v${SHEET_VERSION}-a3.pdf"`,
        "Content-Length": String(a3.length),
      },
    });
  }

  if (page === "all") {
    index = null;
    filename = `ootd-markers-v${SHEET_VERSION}-${paper}-all.pdf`;
  } else {
    index = Number(page);
    if (!Number.isInteger(index) || index < 0 || index >= CORNER_IDS.length) {
      return new NextResponse("No such page", { status: 404 });
    }
    filename = `ootd-marker-${index}-${CORNER_SLUGS[index]}-v${SHEET_VERSION}-${paper}.pdf`;
  }

  const bytes = await buildSheetPdf(index, paper);

  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.length),
    },
  });
}
