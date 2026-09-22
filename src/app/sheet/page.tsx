import Link from "next/link";

import { SectionHead } from "@/components/section-head";
import { AR } from "@/lib/homography/aruco-lib";
import {
  CORNER_IDS,
  DICTIONARY_NAME,
  GREY_PATCH,
  MARKER_SIZE_MM,
  SHEET_HEIGHT_MM,
  SHEET_MARGIN_MM,
  PAPER_SIZES,
  SHEET_VERSION,
  SHEET_WIDTH_MM,
  SUGGESTED_SPANS,
  TILE_BLACK_SQUARE_MM,
  TILE_MARKER_SIZE_MM,
  TARGET_DIAMETER_MM,
  TARGET_OFFSETS,
  TILE_PAGE_HEIGHT_MM,
  TILE_PAGE_WIDTH_MM,
  WHITE_PATCH,
} from "@/lib/homography/sheet";

export const metadata = { title: "Calibration markers" };

const CORNER_NAMES = ["Top left", "Top right", "Bottom right", "Bottom left"];

/** Which of the six distances start at each page, so the page can say so. */
const MEASUREMENTS_FROM: Record<number, string[]> = {
  0: [
    "→ circle on ID 1   =  TOP",
    "→ circle on ID 3   =  LEFT",
    "→ circle on ID 2   =  DIAG   (the one diagonal you must take)",
  ],
  1: [
    "→ circle on ID 0   =  TOP",
    "→ circle on ID 2   =  RIGHT",
    "→ circle on ID 3   =  DIAG2  (optional, only checks the others)",
  ],
  2: [
    "→ circle on ID 1   =  RIGHT",
    "→ circle on ID 3   =  BOTTOM",
    "→ circle on ID 0   =  DIAG   (the one diagonal you must take)",
  ],
  3: [
    "→ circle on ID 0   =  LEFT",
    "→ circle on ID 2   =  BOTTOM",
    "→ circle on ID 1   =  DIAG2  (optional, only checks the others)",
  ],
};

/**
 * The printable markers, generated rather than shipped as a static PDF so the
 * IDs, sizes and version can never drift from what the detector expects.
 *
 * Default layout is one marker per A4 page. A garment is far larger than any
 * sheet you can print (a tee covers A3 and every marker on it) so the four
 * markers are taped out around the garment instead, and you measure the span
 * you actually made.
 */
export default async function SheetPage({
  searchParams,
}: {
  searchParams: Promise<{ layout?: string; paper?: string; pages?: string }>;
}) {
  const { layout, paper: paperParam, pages: pagesParam } = await searchParams;
  const tiled = layout !== "a3";
  const paper = paperParam === "letter" ? "letter" : "a4";
  // Which file: all four pages, or one corner. Defaults to all.
  const pages =
    pagesParam && ["0", "1", "2", "3"].includes(pagesParam)
      ? pagesParam
      : "all";

  const dictionary = new AR.Dictionary(DICTIONARY_NAME);

  return (
    <>
      <div className="mx-auto max-w-3xl print:hidden">
        <SectionHead bleed aside={`V${SHEET_VERSION} · ${DICTIONARY_NAME}`}>
          Calibration markers
        </SectionHead>

        <div className="mb-8 flex gap-2">
          <Link href="/sheet" className="chip" aria-pressed={tiled}>
            Tiled · 4 pages · any size
          </Link>
          <Link href="/sheet?layout=a3" className="chip" aria-pressed={!tiled}>
            Single A3 · small items
          </Link>
        </div>

        {tiled ? (
          <TiledInstructions paper={paper} pages={pages} />
        ) : (
          <A3Instructions />
        )}
      </div>

      {/* The pages are laid out at their printed size in millimetres, which
          is wider than a phone. The page itself never scrolls sideways, so
          the preview scrolls inside its own box instead. */}
      <div className="sheet-preview">
        {tiled ? (
          CORNER_IDS.map((id, index) => (
            <TilePage
              key={id}
              svg={dictionary.generateSVG(id)}
              id={id}
              isLast={index === CORNER_IDS.length - 1}
              corner={CORNER_NAMES[index]}
              withPatches={index === 0}
            />
          ))
        ) : (
          <A3Sheet dictionary={dictionary} />
        )}
      </div>

      <style>{`
        .sheet-preview { overflow-x: auto; }
        .tile {
          position: relative;
          width: ${TILE_PAGE_WIDTH_MM}mm;
          height: ${TILE_PAGE_HEIGHT_MM}mm;
          background: #ffffff;
          margin: 0 auto 8mm;
          border: 1px solid var(--rule);
          break-after: page;
          page-break-after: always;
        }
        /* Breaking after the final tile prints a blank fifth sheet. */
        .tile-last { break-after: auto; page-break-after: auto; }
        .sheet {
          position: relative;
          width: ${SHEET_WIDTH_MM}mm;
          height: ${SHEET_HEIGHT_MM}mm;
          background: #ffffff;
          margin: 0 auto;
          border: 1px solid var(--rule);
        }
        .mk { position: absolute; }
        .mk svg { display: block; width: 100%; height: 100%; }
        .patch { position: absolute; border: 0.2mm solid #000000; }
        .patch span {
          position: absolute; bottom: -5mm; left: 0;
          font-size: 3mm; letter-spacing: 0.1em; color: #000000;
          white-space: nowrap;
        }
        .target { position: absolute; }
        .target span {
          position: absolute; display: block; background: #000000;
        }
        /* outer ring */
        .target {
          border: 0.9mm solid #000000;
          border-radius: 50%;
        }
        /* crosshair arms, stopping short of the centre dot */
        .t-w { left: 0;   top: 50%;  width: 34%;   height: 0.6mm; margin-top: -0.3mm; }
        .t-e { right: 0;  top: 50%;  width: 34%;   height: 0.6mm; margin-top: -0.3mm; }
        .t-n { top: 0;    left: 50%; height: 34%;  width: 0.6mm;  margin-left: -0.3mm; }
        .t-s { bottom: 0; left: 50%; height: 34%;  width: 0.6mm;  margin-left: -0.3mm; }
        .t-c {
          left: 50%; top: 50%; width: 2.4mm; height: 2.4mm;
          margin: -1.2mm 0 0 -1.2mm; border-radius: 50%;
        }
        .cap-strong {
          position: absolute; font-size: 4.4mm; font-weight: 700;
          letter-spacing: 0.02em; color: #000000; white-space: nowrap;
        }
        .cap {
          position: absolute; font-size: 3.4mm;
          letter-spacing: 0.08em; color: #000000;
        }
        @page { size: A4 portrait; margin: 0; }
        @media print {
          body { background: #ffffff; }
          main { padding: 0 !important; }
          header { display: none !important; }
          .tile, .sheet { border: none; margin: 0; }
          .sheet-preview { overflow: visible; }
        }
      `}</style>
    </>
  );
}

/**
 * What to put a tape measure between. Six distances, every one of them
 * between the *same feature* on two pages.
 */
function RigDiagram() {
  // Deliberately not a rectangle: the rig does not have to be one.
  // ox/oy put each circle on the page's interior side, as printed.
  const pts = [
    { id: 0, x: 60, y: 50, ox: 17, oy: 24 },
    { id: 1, x: 330, y: 38, ox: -17, oy: 24 },
    { id: 2, x: 344, y: 300, ox: -17, oy: -24 },
    { id: 3, x: 48, y: 288, ox: 17, oy: -24 },
  ];
  const p = (i: number) => pts[i];
  const edges = [
    { a: 0, b: 1, name: "TOP", env: "TOP_MM", dash: false, off: -10 },
    { a: 1, b: 2, name: "RIGHT", env: "RIGHT_MM", dash: false, off: 14 },
    { a: 3, b: 2, name: "BOTTOM", env: "BOTTOM_MM", dash: false, off: 16 },
    { a: 0, b: 3, name: "LEFT", env: "LEFT_MM", dash: false, off: -14 },
    { a: 0, b: 2, name: "DIAG", env: "DIAG_MM", dash: false, off: -6 },
    {
      a: 1,
      b: 3,
      name: "DIAG2 (optional)",
      env: "DIAG2_MM",
      dash: true,
      off: 12,
    },
  ];

  return (
    <svg
      viewBox="0 0 420 360"
      className="mb-6 w-full max-w-lg"
      role="img"
      aria-label="Six distances between the four marker pages: the four sides and both diagonals, each measured between the printed circle on one page and the printed circle on another."
    >
      {edges.map((e) => {
        // Lines run circle to circle, because that is what you measure.
        const a = { x: p(e.a).x + p(e.a).ox, y: p(e.a).y + p(e.a).oy };
        const b = { x: p(e.b).x + p(e.b).ox, y: p(e.b).y + p(e.b).oy };
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        return (
          <g key={e.name}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={e.dash ? "var(--fg3)" : "var(--fg)"}
              strokeWidth="1"
              strokeDasharray={e.dash ? "4 4" : undefined}
            />
            <text
              x={mx + e.off}
              y={my + e.off}
              fill="var(--fg2)"
              fontSize="9"
              fontFamily="var(--font-mono)"
              textAnchor="middle"
            >
              {e.name}
            </text>
          </g>
        );
      })}

      {pts.map((pt) => (
        <g key={pt.id}>
          {/* The page, and the black square whose corner you measure from. */}
          <rect
            x={pt.x - 26}
            y={pt.y - 34}
            width="52"
            height="68"
            fill="var(--bg)"
            stroke="var(--rule)"
            strokeWidth="1"
          />
          <rect
            x={pt.x - 18}
            y={pt.y - 18}
            width="36"
            height="36"
            fill="var(--fg)"
          />
          {/* The printed target, facing the middle. It is the only thing a
              tape touches, and the reason the layout reads itself. */}
          <circle
            cx={pt.x + pt.ox}
            cy={pt.y + pt.oy}
            r="5.5"
            fill="var(--bg)"
            stroke="var(--fg)"
            strokeWidth="1.5"
          />
          <circle
            cx={pt.x + pt.ox}
            cy={pt.y + pt.oy}
            r="1.4"
            fill="var(--fg)"
          />
          <text
            x={pt.x}
            y={pt.y + 48}
            fill="var(--fg2)"
            fontSize="8"
            fontFamily="var(--font-mono)"
            textAnchor="middle"
          >
            ID {pt.id}
          </text>
        </g>
      ))}
    </svg>
  );
}

function TiledInstructions({
  paper,
  pages,
}: {
  paper: "a4" | "letter";
  pages: string;
}) {
  // Every choice is a link, so the page stays a Server Component and the
  // download URL is just the current choice.
  const href = (next: { paper?: string; pages?: string }) => {
    const q = new URLSearchParams();
    const p = next.paper ?? paper;
    const g = next.pages ?? pages;
    if (p !== "a4") q.set("paper", p);
    if (g !== "all") q.set("pages", g);
    const qs = q.toString();
    return `/sheet${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <div className="mb-10">
        <p className="label text-fg2 mb-2">Paper</p>
        <div className="mb-2 flex flex-wrap gap-2">
          {(Object.keys(PAPER_SIZES) as (keyof typeof PAPER_SIZES)[]).map(
            (size) => (
              <Link
                key={size}
                className="chip"
                aria-pressed={paper === size}
                href={href({ paper: size })}
              >
                {PAPER_SIZES[size].label} · {PAPER_SIZES[size].widthMm}×
                {PAPER_SIZES[size].heightMm}
              </Link>
            ),
          )}
        </div>
        <p className="text-fg2 mb-6">
          Pick the paper actually in the tray. A4 sent to a Letter tray is
          scaled to fit, and every measurement inherits that.
        </p>

        <p className="label text-fg2 mb-2">Pages</p>
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            className="chip"
            aria-pressed={pages === "all"}
            href={href({ pages: "all" })}
          >
            All four pages
          </Link>
          {CORNER_IDS.map((id, index) => (
            <Link
              key={id}
              className="chip"
              aria-pressed={pages === String(index)}
              href={href({ pages: String(index) })}
            >
              {CORNER_NAMES[index]} · ID {id}
            </Link>
          ))}
        </div>

        {/* The one filled button on the page: a PDF, not the browser's
            print, because a PDF carries its own page size. */}
        <div className="flex flex-col items-center gap-3">
          <a
            className="btn-primary px-12 py-4"
            href={`/api/sheet/${pages}?paper=${paper}`}
            download
          >
            Download PDF
          </a>
          <p className="text-fg3 text-center">
            Print it at 100% scale, with fit to page off.
          </p>
        </div>
      </div>

      <p className="text-fg2 mb-5 max-w-lg">
        Four pages, one marker each. They only need to be flat, in the same
        plane, and a known distance apart. That lets the rectangle be bigger
        than the garment.
      </p>

      <ol className="text-fg2 mb-6 max-w-lg list-decimal space-y-3 pl-5">
        <li>
          Print all four pages at{" "}
          <strong className="text-fg">100% scale</strong>, with fit to page off.
          The black square must measure{" "}
          <strong className="text-fg">{TILE_BLACK_SQUARE_MM}&nbsp;mm</strong> a
          side. If it does not, the printer scaled it.
        </li>
        <li>
          Tape the pages down, marker side up, at the corners of a space larger
          than the garment. The circles face inward. The shape does not need to
          be square.
        </li>
        <li>
          <strong className="text-fg">
            Keep all four pages square to each other
          </strong>
          , facing the same way up. A degree of rotation costs about a
          millimetre, so line them up against a wall, a floorboard or a taut
          string.
        </li>
        <li>
          Measure{" "}
          <strong className="text-fg">circle centre to circle centre</strong>.
          Never paper edge to paper edge.
        </li>
        <li>
          Take <strong className="text-fg">five</strong> distances: the four
          sides, plus the diagonal from ID&nbsp;0 to ID&nbsp;2. The diagonal is
          what fixes the shape. Without it a skewed rig reads every side
          correctly and still gets a sleeve wrong.
        </li>
        <li>
          The second diagonal, ID&nbsp;1 to ID&nbsp;3, is optional. Set{" "}
          <code className="data">NEXT_PUBLIC_SHEET_DIAG2_MM</code> and capture
          cross-checks the other five.
        </li>
        <li>
          Lay the garment flat inside the rectangle and shoot straight down with
          all four markers in frame.
        </li>
      </ol>

      <RigDiagram />

      <div className="rule-top mb-6 pt-3">
        <p className="label text-fg2 mb-2">Where the six numbers go</p>
        {[
          ["NEXT_PUBLIC_SHEET_TOP_MM", "ID 0 → 1, across the top"],
          ["NEXT_PUBLIC_SHEET_RIGHT_MM", "ID 1 → 2, down the right"],
          ["NEXT_PUBLIC_SHEET_BOTTOM_MM", "ID 3 → 2, across the bottom"],
          ["NEXT_PUBLIC_SHEET_LEFT_MM", "ID 0 → 3, down the left"],
          ["NEXT_PUBLIC_SHEET_DIAG_MM", "ID 0 → 2, required"],
          ["NEXT_PUBLIC_SHEET_DIAG2_MM", "ID 1 → 3, optional check"],
        ].map(([envVar, what]) => (
          <div
            key={envVar}
            className="rule-top flex justify-between gap-4 py-1.5"
          >
            <code className="data text-fg2">{envVar}</code>
            <span className="text-fg2 text-right">{what}</span>
          </div>
        ))}
      </div>

      <div className="rule-top mb-6 pt-3">
        <p className="label text-fg2 mb-2">
          Sizes that work: marker span, then what the tape reads
        </p>
        {SUGGESTED_SPANS.map((span) => (
          <div
            key={span.label}
            className="rule-top flex justify-between py-1.5"
          >
            <span className="text-fg2">{span.label}</span>
            <span className="data">
              {span.xMm} × {span.yMm}
              <span className="text-fg3">
                {"  →  "}
                {span.xMm - 130} × {span.yMm - 136} mm
              </span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function A3Instructions() {
  return (
    <div className="mb-10">
      <div className="mb-8 flex flex-col items-center gap-3">
        <a className="btn-primary px-12 py-4" href="/api/sheet/a3" download>
          Download PDF
        </a>
        <p className="text-fg3 text-center">
          A3, printed at 100% scale, with fit to page off.
        </p>
      </div>
      <p className="text-fg2 max-w-lg">
        One A3 sheet, markers {MARKER_SIZE_MM}&nbsp;mm at the corners. Only
        useful for something that fits inside{" "}
        {SHEET_WIDTH_MM - 2 * SHEET_MARGIN_MM} ×{" "}
        {SHEET_HEIGHT_MM - 2 * SHEET_MARGIN_MM}&nbsp;mm without covering a
        marker, such as a cap or a folded accessory. A tee is about 530&nbsp;mm
        across and hides all four. Print at 100%, measure the marker centres,
        set the two spacing env vars.
      </p>
    </div>
  );
}

function TilePage({
  svg,
  id,
  corner,
  withPatches,
  isLast,
}: {
  svg: string;
  id: number;
  corner: string;
  withPatches: boolean;
  isLast: boolean;
}) {
  const cx = TILE_PAGE_WIDTH_MM / 2;
  const cy = TILE_PAGE_HEIGHT_MM / 2;
  const half = TILE_MARKER_SIZE_MM / 2;
  const offset = TARGET_OFFSETS[id];

  return (
    <div className={isLast ? "tile tile-last" : "tile"}>
      <div
        className="mk"
        style={{
          left: `${cx - half}mm`,
          top: `${cy - half}mm`,
          width: `${TILE_MARKER_SIZE_MM}mm`,
          height: `${TILE_MARKER_SIZE_MM}mm`,
        }}
        // Generated by js-aruco2 from the dictionary: a fixed string of rects.
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {/* The one thing to put a tape on. It faces the middle of the rig,
          so the four circles outline the space the garment goes in. */}
      <div
        className="target"
        style={{
          left: `${cx + offset.x - TARGET_DIAMETER_MM / 2}mm`,
          top: `${cy + offset.y - TARGET_DIAMETER_MM / 2}mm`,
          width: `${TARGET_DIAMETER_MM}mm`,
          height: `${TARGET_DIAMETER_MM}mm`,
        }}
      >
        <span className="t-w" />
        <span className="t-e" />
        <span className="t-n" />
        <span className="t-s" />
        <span className="t-c" />
      </div>
      <div
        className="cap-strong"
        style={
          // The label sits on whichever side of the circle has room.
          offset.x > 0
            ? {
                right: `${TILE_PAGE_WIDTH_MM - (cx + offset.x - TARGET_DIAMETER_MM / 2 - 6)}mm`,
                top: `${cy + offset.y - 3}mm`,
                textAlign: "right" as const,
              }
            : {
                left: `${cx + offset.x + TARGET_DIAMETER_MM / 2 + 6}mm`,
                top: `${cy + offset.y - 3}mm`,
              }
        }
      >
        {offset.x > 0
          ? "MEASURE FROM THE CENTRE OF THIS CIRCLE →"
          : "← MEASURE FROM THE CENTRE OF THIS CIRCLE"}
      </div>

      {withPatches
        ? [
            { patch: GREY_PATCH, label: "NEUTRAL" },
            { patch: WHITE_PATCH, label: "WHITE" },
          ].map(({ patch, label }) => (
            <div
              key={label}
              className="patch"
              style={{
                left: `${cx + patch.offsetXMm - patch.sizeMm / 2}mm`,
                top: `${cy + patch.offsetYMm - patch.sizeMm / 2}mm`,
                width: `${patch.sizeMm}mm`,
                height: `${patch.sizeMm}mm`,
                background: patch.hex,
              }}
            >
              <span>
                {label} {patch.hex}
              </span>
            </div>
          ))
        : null}

      <div className="cap" style={{ left: "14mm", top: "15mm" }}>
        ↑ THIS EDGE AWAY FROM YOU · {corner.toUpperCase()} · ID {id}
      </div>
      <div className="cap-strong" style={{ left: "14mm", top: "25mm" }}>
        THE THREE DISTANCES THAT START HERE
      </div>
      {MEASUREMENTS_FROM[id].map((line, i) => (
        <div
          key={line}
          className="cap"
          style={{ left: "14mm", top: `${34 + i * 6.5}mm` }}
        >
          {line}
        </div>
      ))}
      <div
        className="cap"
        style={{ left: "12mm", top: `${TILE_PAGE_HEIGHT_MM - 16}mm` }}
      >
        OOTD V{SHEET_VERSION} · {DICTIONARY_NAME} · PRINT AT 100% · BLACK SQUARE
        MUST MEASURE {TILE_BLACK_SQUARE_MM} MM · KEEP ALL FOUR PAGES SQUARE TO
        EACH OTHER
      </div>
    </div>
  );
}

function A3Sheet({
  dictionary,
}: {
  dictionary: InstanceType<typeof AR.Dictionary>;
}) {
  const corners = [
    { id: CORNER_IDS[0], xMm: SHEET_MARGIN_MM, yMm: SHEET_MARGIN_MM },
    {
      id: CORNER_IDS[1],
      xMm: SHEET_WIDTH_MM - SHEET_MARGIN_MM - MARKER_SIZE_MM,
      yMm: SHEET_MARGIN_MM,
    },
    {
      id: CORNER_IDS[2],
      xMm: SHEET_WIDTH_MM - SHEET_MARGIN_MM - MARKER_SIZE_MM,
      yMm: SHEET_HEIGHT_MM - SHEET_MARGIN_MM - MARKER_SIZE_MM,
    },
    {
      id: CORNER_IDS[3],
      xMm: SHEET_MARGIN_MM,
      yMm: SHEET_HEIGHT_MM - SHEET_MARGIN_MM - MARKER_SIZE_MM,
    },
  ];

  return (
    <div className="sheet">
      {corners.map((m) => (
        <div
          key={m.id}
          className="mk"
          style={{
            left: `${m.xMm}mm`,
            top: `${m.yMm}mm`,
            width: `${MARKER_SIZE_MM}mm`,
            height: `${MARKER_SIZE_MM}mm`,
          }}
          dangerouslySetInnerHTML={{ __html: dictionary.generateSVG(m.id) }}
        />
      ))}

      {/* No colour patches here. They are located by a fixed offset from the
          top-left marker centre, and on A3 that offset falls off the paper.
          Printing them anywhere else means the app samples the wrong pixels.
          The tiled layout carries them. */}
      <div
        className="cap"
        style={{ left: "15mm", top: `${SHEET_HEIGHT_MM - 10}mm` }}
      >
        OOTD V{SHEET_VERSION} · {DICTIONARY_NAME} · SMALL ITEMS ONLY · NO GREY
        PATCH · PRINT AT 100%
      </div>
    </div>
  );
}
