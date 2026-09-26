import { GarmentFigure, SILHOUETTES } from "@/components/garment-hint";
import type {
  Category,
  Dimension,
  MeasurementKey,
  Silhouette,
} from "@/lib/measure/templates";
import { type DisplayUnit, formatLength, unitSuffix } from "@/lib/units";

/**
 * The whole garment with its dimensions drawn on.
 *
 * A stored list reading "P2P 530 / SH 452 / SL 218" is only checkable by
 * someone who already knows what those three letters mean and which way the
 * line runs. On the diagram a wrong number is obvious at a glance: a sleeve
 * longer than the body, a shoulder wider than the chest.
 *
 * Every stroke is a hairline in screen pixels (`vectorEffect`), whatever
 * size the diagram is drawn at. The rest of the chrome is 1px rules; a
 * diagram whose lines scale with its box was the one thing on the page that
 * was not.
 *
 * Values are opt-in. With an empty `values` the diagram is a shape with its
 * dimensions marked, which is all a size guide shows until asked.
 */

/* User units inside the viewBox, not pixels: the diagram is drawn at any
   size, so the figures scale with the shape they annotate. */
const FONT_SIZE = 5.8;
/* Tracking on the figures, in em. */
const LETTER_SPACING = 0.02;
/* IBM Plex Mono advances exactly 0.6em a glyph, so the hover box is computed
   rather than measured and needs no layout pass. It has to be exact: a
   padded guess overshoots a little per character, and on the longest
   figures, inches in eighths like 21 5/8", that piled up as a box visibly
   wider on the right than the left. */
const CHAR_W = FONT_SIZE * (0.6 + LETTER_SPACING);
const BOX_PAD_X = 1.4;
const BOX_PAD_Y = 0.9;
/* The white halo behind each figure, half its stroke width. */
const HALO = 1;

type Box = { x: number; y: number; w: number; h: number };

/** Where a figure's hover box sits, from its anchor. */
function labelBox(
  text: string,
  lx: number,
  ly: number,
  anchor: "start" | "middle" | "end",
): Box {
  // Tracking follows every glyph, the last one too, but the last one's
  // is empty space and would pad only the right.
  const w =
    text.length * CHAR_W - FONT_SIZE * LETTER_SPACING + BOX_PAD_X * 2;
  const h = FONT_SIZE + BOX_PAD_Y * 2;
  const x =
    anchor === "end"
      ? lx - w + BOX_PAD_X
      : anchor === "middle"
        ? lx - w / 2
        : lx - BOX_PAD_X;
  return { x, y: ly - FONT_SIZE * 0.78 - BOX_PAD_Y, w, h };
}

/**
 * The drawing's frame, grown to take every figure it carries.
 *
 * The padded box is sized for the shape, and a label hung off the far end of
 * a sleeve does not fit in it once it reads "21 5/8 \"" rather than "548 mm".
 * An SVG clips at its viewBox, so the figure was cut off mid-number. Growing
 * the frame to the labels actually drawn means no unit and no text size can
 * clip, at the cost of the shape drawing a touch smaller when one sticks out.
 */
function frameFor(padded: string, boxes: Box[]): string {
  const [px, py, pw, ph] = padded.split(" ").map(Number);
  let x0 = px;
  let y0 = py;
  let x1 = px + pw;
  let y1 = py + ph;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x - HALO);
    y0 = Math.min(y0, b.y - HALO);
    x1 = Math.max(x1, b.x + b.w + HALO);
    y1 = Math.max(y1, b.y + b.h + HALO);
  }
  return `${x0} ${y0} ${x1 - x0} ${y1 - y0}`;
}

export function GarmentSchematic({
  silhouette,
  category,
  dimensions,
  values,
  activeKey,
  unit = "mm",
  onHover,
  onSelect,
  className,
}: {
  silhouette: Silhouette;
  /** Draw this garment's own collar and pockets; the lines are the same. */
  category?: Category | null;
  dimensions: Dimension[];
  values: Record<string, number | undefined>;
  activeKey?: MeasurementKey | null;
  unit?: DisplayUnit;
  /** Which dimension the pointer is over, or null when it leaves. */
  onHover?: (key: MeasurementKey | null) => void;
  /** A tap or click on a dimension. Makes the diagram selectable. */
  onSelect?: (key: MeasurementKey) => void;
  className?: string;
}) {
  const shape = SILHOUETTES[silhouette];
  const showingValues = Object.keys(values).length > 0;

  const labels = dimensions.map((dimension) => {
    const mm = values[dimension.key];
    const text =
      mm != null ? `${formatLength(mm, unit)} ${unitSuffix(unit)}` : "—";
    const { lx, ly, anchor } = dimension.hint;
    return { mm, text, box: labelBox(text, lx, ly, anchor) };
  });
  const viewBox = showingValues
    ? frameFor(
        shape.padded,
        labels.map((l) => l.box),
      )
    : shape.padded;

  return (
    <svg
      viewBox={viewBox}
      className={className}
      role="img"
      aria-label={dimensions
        .map((d) =>
          showingValues
            ? `${d.label} ${values[d.key] != null ? `${values[d.key]} millimetres` : "not placed"}`
            : d.label,
        )
        .join(", ")}
    >
      <GarmentFigure silhouette={silhouette} category={category} />

      {dimensions.map((dimension, i) => {
        const { x1, y1, x2, y2, lx, ly, anchor } = dimension.hint;
        const { mm, text, box } = labels[i];
        const active = activeKey === dimension.key;
        const stroke = active ? "var(--fg)" : "var(--fg3)";

        return (
          /* `.schematic-dim` carries the hover: the line goes solid and
             full-strength and the number underlines, so pointing at a
             figure shows which line it measures. See globals.css. */
          <g
            key={dimension.key}
            className="schematic-dim"
            data-active={active || undefined}
            /* Handlers only when asked for, so a Server Component can draw
               the diagram as a static figure. */
            /* Hover is a mouse thing. A tap fires enter and then leave
               before its click, so on a phone the name flashed on, fell
               back for a frame, and came back when the selection landed. */
            onPointerEnter={
              onHover
                ? (e) => {
                    if (e.pointerType === "mouse") {
                      onHover(dimension.key as MeasurementKey);
                    }
                  }
                : undefined
            }
            onPointerLeave={
              onHover
                ? (e) => {
                    if (e.pointerType === "mouse") onHover(null);
                  }
                : undefined
            }
            onClick={
              onSelect
                ? () => onSelect(dimension.key as MeasurementKey)
                : undefined
            }
            style={onSelect ? { cursor: "pointer" } : undefined}
          >
            <title>{dimension.label}</title>
            {/* A wide invisible stroke so a hairline is easy to hover. */}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="transparent"
              strokeWidth={8}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={stroke}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={active ? undefined : "2 2"}
              className="schematic-dim-line"
            />
            {[
              [x1, y1],
              [x2, y2],
            ].map(([x, y]) => (
              <circle
                key={`${x}-${y}`}
                cx={x}
                cy={y}
                r={1.5}
                fill="var(--bg)"
                stroke={stroke}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                className="schematic-dim-end"
              />
            ))}
            {showingValues ? (
              <rect
                x={box.x}
                y={box.y}
                width={box.w}
                height={box.h}
                fill="var(--fg)"
                className="schematic-dim-box"
              />
            ) : null}
            {showingValues ? (
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                /* Not the `.data` class: a CSS font-size beats the attribute,
                   and inside a viewBox its `11px` means eleven *user units*,
                   which here is nearly twice the intended size. */
                style={{
                  fontFamily: "var(--font-mono)",
                  fontVariantNumeric: "tabular-nums",
                  fontSize: FONT_SIZE,
                  letterSpacing: `${LETTER_SPACING}em`,
                }}
                fill={mm != null ? "var(--fg)" : "var(--fg3)"}
                /* A halo, so a label crossing an outline stays readable without
                   introducing a filled box the design system does not allow. */
                stroke="var(--bg)"
                strokeWidth={HALO * 2}
                paintOrder="stroke"
                className="schematic-dim-value"
              >
                {text}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
