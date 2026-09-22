import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";

import { AR } from "./aruco-lib";
import {
  CORNER_IDS,
  DICTIONARY_NAME,
  GREY_PATCH,
  MARKER_BLACK_RATIO,
  SHEET_VERSION,
  TARGET_DIAMETER_MM,
  TARGET_OFFSETS,
  TILE_BLACK_SQUARE_MM,
  TILE_MARKER_SIZE_MM,
  MARKER_SIZE_MM,
  PAPER_SIZES,
  type PaperSize,
  SHEET_HEIGHT_MM,
  SHEET_MARGIN_MM,
  SHEET_WIDTH_MM,
  WHITE_PATCH,
} from "./sheet";

/**
 * The marker pages as a real PDF.
 *
 * Printing the HTML works, but a PDF carries its own physical page size, so
 * "100%" means the same thing in every print dialogue. Since a 2% scale error
 * is 10mm on a chest, that is worth a dependency.
 */

const MM = 72 / 25.4;
const mm = (v: number) => v * MM;

const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);

const CORNER_NAMES = ["TOP LEFT", "TOP RIGHT", "BOTTOM RIGHT", "BOTTOM LEFT"];

const MEASUREMENTS_FROM: Record<number, string[]> = {
  0: [
    "to circle on ID 1   =  TOP",
    "to circle on ID 3   =  LEFT",
    "to circle on ID 2   =  DIAG   (the one diagonal you must take)",
  ],
  1: [
    "to circle on ID 0   =  TOP",
    "to circle on ID 2   =  RIGHT",
    "to circle on ID 3   =  DIAG2  (optional - only checks the others)",
  ],
  2: [
    "to circle on ID 1   =  RIGHT",
    "to circle on ID 3   =  BOTTOM",
    "to circle on ID 0   =  DIAG   (the one diagonal you must take)",
  ],
  3: [
    "to circle on ID 0   =  LEFT",
    "to circle on ID 2   =  BOTTOM",
    "to circle on ID 1   =  DIAG2  (optional - only checks the others)",
  ],
};

/**
 * The single A3 sheet: four markers at the corners, at the exact offsets the
 * on-screen preview and the detector use. Small items only.
 */
export async function buildA3SheetPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`OOTD calibration sheet v${SHEET_VERSION} (A3)`);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const dictionary = new AR.Dictionary(DICTIONARY_NAME);
  const page = doc.addPage([mm(SHEET_WIDTH_MM), mm(SHEET_HEIGHT_MM)]);

  const y = (topMm: number) => mm(SHEET_HEIGHT_MM - topMm);
  const box = (
    xMm: number,
    topMm: number,
    wMm: number,
    hMm: number,
    color = BLACK,
  ) =>
    page.drawRectangle({
      x: mm(xMm),
      y: y(topMm + hMm),
      width: mm(wMm),
      height: mm(hMm),
      color,
    });

  const half = MARKER_SIZE_MM / 2;
  const corners: [number, number][] = [
    [SHEET_MARGIN_MM + half, SHEET_MARGIN_MM + half],
    [SHEET_WIDTH_MM - SHEET_MARGIN_MM - half, SHEET_MARGIN_MM + half],
    [
      SHEET_WIDTH_MM - SHEET_MARGIN_MM - half,
      SHEET_HEIGHT_MM - SHEET_MARGIN_MM - half,
    ],
    [SHEET_MARGIN_MM + half, SHEET_HEIGHT_MM - SHEET_MARGIN_MM - half],
  ];
  corners.forEach(([cx, cy], index) => {
    drawMarker(page, dictionary, CORNER_IDS[index], cx, cy, MARKER_SIZE_MM, box);
  });

  const sizeMm = 3.2;
  page.drawText(
    `OOTD V${SHEET_VERSION}  -  ${DICTIONARY_NAME}  -  A3  -  PRINT AT 100%  -  MARKERS ${MARKER_SIZE_MM} MM`,
    {
      x: mm(SHEET_MARGIN_MM + MARKER_SIZE_MM + 8),
      y: y(SHEET_MARGIN_MM + sizeMm * 0.8),
      size: mm(sizeMm),
      font: regular,
      color: BLACK,
    },
  );

  return doc.save();
}

/** `pageIndex` 0..3, or null for all four in one file. */
export async function buildSheetPdf(
  pageIndex: number | null,
  paper: PaperSize = "a4",
): Promise<Uint8Array> {
  const { widthMm, heightMm, label } = PAPER_SIZES[paper];

  const doc = await PDFDocument.create();
  doc.setTitle(
    pageIndex === null
      ? `OOTD calibration markers v${SHEET_VERSION} (${label})`
      : `OOTD calibration marker ${pageIndex} v${SHEET_VERSION} (${label})`,
  );

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const dictionary = new AR.Dictionary(DICTIONARY_NAME);

  const indices = pageIndex === null ? [0, 1, 2, 3] : [pageIndex];
  for (const index of indices) {
    const page = doc.addPage([mm(widthMm), mm(heightMm)]);
    drawTile(page, index, dictionary, regular, bold, widthMm, heightMm, label);
  }

  return doc.save();
}

function drawTile(
  page: PDFPage,
  index: number,
  dictionary: InstanceType<typeof AR.Dictionary>,
  regular: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  pageWidthMm: number,
  pageHeightMm: number,
  paperLabel: string,
) {
  const id = CORNER_IDS[index];
  const cx = pageWidthMm / 2;
  const cy = pageHeightMm / 2;
  const offset = TARGET_OFFSETS[index];

  // PDF y runs up from the bottom; everything else here is measured down from
  // the top, as on the screen.
  const y = (topMm: number) => mm(pageHeightMm - topMm);

  const text = (
    s: string,
    xMm: number,
    topMm: number,
    sizeMm: number,
    heavy = false,
  ) =>
    page.drawText(s, {
      x: mm(xMm),
      y: y(topMm + sizeMm * 0.8),
      size: mm(sizeMm),
      font: heavy ? bold : regular,
      color: BLACK,
    });

  const box = (
    xMm: number,
    topMm: number,
    wMm: number,
    hMm: number,
    color = BLACK,
  ) =>
    page.drawRectangle({
      x: mm(xMm),
      y: y(topMm + hMm),
      width: mm(wMm),
      height: mm(hMm),
      color,
    });

  text(`THIS EDGE AWAY FROM YOU  -  ${CORNER_NAMES[index]}  -  ID ${id}`, 14, 15, 3.4);

  text("THE THREE DISTANCES THAT START HERE", 14, 25, 4.4, true);
  MEASUREMENTS_FROM[index].forEach((line, i) => {
    text(line, 14, 34 + i * 6.5, 3.4);
  });

  drawMarker(page, dictionary, id, cx, cy, TILE_MARKER_SIZE_MM, box);

  if (index === 0) {
    for (const [patch, label] of [
      [GREY_PATCH, "NEUTRAL"],
      [WHITE_PATCH, "WHITE"],
    ] as const) {
      const left = cx + patch.offsetXMm - patch.sizeMm / 2;
      const top = cy + patch.offsetYMm - patch.sizeMm / 2;
      const [r, g, b] = hexToRgb(patch.hex);
      box(left, top, patch.sizeMm, patch.sizeMm, rgb(r, g, b));
      page.drawRectangle({
        x: mm(left),
        y: y(top + patch.sizeMm),
        width: mm(patch.sizeMm),
        height: mm(patch.sizeMm),
        borderColor: BLACK,
        borderWidth: mm(0.2),
      });
      text(`${label} ${patch.hex}`, left, top + patch.sizeMm + 1.5, 3);
    }

  }

  drawTarget(page, cx + offset.x, cy + offset.y, y);
  const label = "MEASURE FROM THE CENTRE OF THIS CIRCLE";
  if (offset.x > 0) {
    const width = bold.widthOfTextAtSize(`${label} >`, mm(4.4)) / MM;
    text(`${label} >`, cx + offset.x - TARGET_DIAMETER_MM / 2 - 6 - width, cy + offset.y - 3, 4.4, true);
  } else {
    text(`< ${label}`, cx + offset.x + TARGET_DIAMETER_MM / 2 + 6, cy + offset.y - 3, 4.4, true);
  }

  text(
    `OOTD V${SHEET_VERSION}  -  ${DICTIONARY_NAME}  -  ${paperLabel}  -  PRINT AT 100%  -  BLACK SQUARE MUST MEASURE ${TILE_BLACK_SQUARE_MM} MM`,
    14,
    cy + 90,
    3.2,
  );
  text("KEEP ALL FOUR PAGES SQUARE TO EACH OTHER", 14, cy + 95, 3.2);
}

/** White quiet zone, black frame, then the dictionary's bits knocked out. */
function drawMarker(
  page: PDFPage,
  dictionary: InstanceType<typeof AR.Dictionary>,
  id: number,
  centreXMm: number,
  centreYMm: number,
  sizeMm: number,
  box: (x: number, top: number, w: number, h: number, c?: ReturnType<typeof rgb>) => void,
) {
  const code = dictionary.codeList[id];
  const grid = dictionary.markSize - 2;
  const unit = sizeMm / (grid + 4);

  const left = centreXMm - sizeMm / 2;
  const top = centreYMm - sizeMm / 2;

  box(left, top, sizeMm, sizeMm, WHITE);
  box(left + unit, top + unit, sizeMm - 2 * unit, sizeMm - 2 * unit, BLACK);

  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      if (code[gy * grid + gx] === "1") {
        box(left + (gx + 2) * unit, top + (gy + 2) * unit, unit, unit, WHITE);
      }
    }
  }
}

function drawTarget(
  page: PDFPage,
  centreXMm: number,
  centreYMm: number,
  y: (topMm: number) => number,
) {
  const r = TARGET_DIAMETER_MM / 2;
  page.drawCircle({
    x: mm(centreXMm),
    y: y(centreYMm),
    size: mm(r - 0.45),
    borderColor: BLACK,
    borderWidth: mm(0.9),
  });

  const arm = r * 0.68;
  const gap = r * 0.34;
  for (const [x1, y1, x2, y2] of [
    [centreXMm - r, centreYMm, centreXMm - gap, centreYMm],
    [centreXMm + gap, centreYMm, centreXMm + r, centreYMm],
    [centreXMm, centreYMm - r, centreXMm, centreYMm - gap],
    [centreXMm, centreYMm + gap, centreXMm, centreYMm + r],
  ]) {
    page.drawLine({
      start: { x: mm(x1), y: y(y1) },
      end: { x: mm(x2), y: y(y2) },
      thickness: mm(0.6),
      color: BLACK,
    });
  }
  void arm;

  page.drawCircle({
    x: mm(centreXMm),
    y: y(centreYMm),
    size: mm(1.2),
    color: BLACK,
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export { MARKER_BLACK_RATIO };
