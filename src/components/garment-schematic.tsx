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
const FONT_SIZE = 4.6;
/* Mono glyphs are ~0.6em wide; the hover box is sized from that rather than
   measured, so it needs no layout pass. */
const CHAR_W = FONT_SIZE * 0.66;
const BOX_PAD_X = 1.4;
const BOX_PAD_Y = 0.9;

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

  return (
    <svg
      viewBox={shape.padded}
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

      {dimensions.map((dimension) => {
        const { x1, y1, x2, y2, lx, ly, anchor } = dimension.hint;
        const mm = values[dimension.key];
        const active = activeKey === dimension.key;
        const stroke = active ? "var(--fg)" : "var(--fg3)";
        const text =
          mm != null ? `${formatLength(mm, unit)} ${unitSuffix(unit)}` : "—";
        // Box geometry for the hover state, from the text anchor.
        const w = text.length * CHAR_W + BOX_PAD_X * 2;
        const h = FONT_SIZE + BOX_PAD_Y * 2;
        const bx =
          anchor === "end"
            ? lx - w + BOX_PAD_X
            : anchor === "middle"
              ? lx - w / 2
              : lx - BOX_PAD_X;
        const by = ly - FONT_SIZE * 0.78 - BOX_PAD_Y;

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
            onPointerEnter={
              onHover
                ? () => onHover(dimension.key as MeasurementKey)
                : undefined
            }
            onPointerLeave={onHover ? () => onHover(null) : undefined}
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
                x={bx}
                y={by}
                width={w}
                height={h}
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
                  letterSpacing: "0.02em",
                }}
                fill={mm != null ? "var(--fg)" : "var(--fg3)"}
                /* A halo, so a label crossing an outline stays readable without
                   introducing a filled box the design system does not allow. */
                stroke="var(--bg)"
                strokeWidth={2}
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
