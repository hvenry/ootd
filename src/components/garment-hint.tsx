import {
  isBottomSilhouette,
  type Dimension,
  type Silhouette,
} from "@/lib/measure/templates";

/** Height over width of each silhouette's own viewBox. */
const ASPECT: Record<Silhouette, number> = {
  top: 1.2,
  long_top: 1.2,
  vest: 1.2,
  bottom: 1.4,
  shorts: 0.9,
};

/**
 * The hint sketch: where this measurement's two points actually go.
 *
 * "Front rise" and "back rise" are the same words to anyone who has not
 * measured trousers before, and "body length" says nothing about whether it
 * starts at the shoulder seam or the neck. A silhouette with two dots on it
 * settles the question in less time than a sentence could.
 */

export const SILHOUETTES: Record<
  Silhouette,
  {
    viewBox: string;
    /** Same shape with room around it for value labels. */ padded: string;
    path: string;
  }
> = {
  top: {
    viewBox: "0 0 100 120",
    padded: "-20 -12 144 146",
    // Shoulders, sleeves, straight body to the hem, narrow neck.
    path:
      "M30,10 L8,20 L4,44 L20,50 L26,36 L26,110 L74,110 L74,36 L80,50 " +
      "L96,44 L92,20 L70,10 L62,16 Q50,20 38,16 Z",
  },
  long_top: {
    viewBox: "-8 0 116 120",
    padded: "-20 -12 144 146",
    // Same body, sleeves hanging out to a cuff. The top edge of each sleeve
    // is one straight segment from the shoulder seam, because that edge is
    // the sleeve measurement and the hint line sits exactly on it.
    path:
      "M30,10 L-4,78 L10,84 L26,40 L26,110 L74,110 L74,40 L90,84 L104,78 " +
      "L70,10 L62,16 Q50,20 38,16 Z",
  },
  vest: {
    viewBox: "0 0 100 120",
    padded: "-20 -12 144 146",
    // No sleeves: the armhole curves from the shoulder point into the body.
    path:
      "M30,10 L20,14 Q16,30 26,44 L26,110 L74,110 L74,44 Q84,30 80,14 " +
      "L70,10 L62,16 Q50,20 38,16 Z",
  },
  shorts: {
    viewBox: "0 0 100 90",
    padded: "-22 -16 144 124",
    // Waistband, hips, a crotch about halfway down, two short legs.
    path: "M18,6 L82,6 L86,44 L86,80 L56,80 L50,50 L44,80 L14,80 L14,44 Z",
  },
  bottom: {
    viewBox: "0 0 100 140",
    padded: "-22 -16 144 174",
    // Waistband, hips, crotch, two legs.
    path: "M18,6 L82,6 L84,50 L78,134 L54,134 L50,56 L46,134 L22,134 L16,50 Z",
  },
};

/**
 * The bare silhouette, no dimension on it. Capture uses this to say which
 * shape to lay out: a shirt and a pair of trousers are laid out differently
 * and the guide is wrong for one of them if it never changes.
 */
export function GarmentOutline({
  silhouette,
  size = 72,
}: {
  silhouette: Silhouette;
  size?: number;
}) {
  const shape = SILHOUETTES[silhouette];
  return (
    <svg
      viewBox={shape.viewBox}
      width={size}
      height={size * ASPECT[silhouette]}
      className="shrink-0"
      role="img"
      aria-label={
        isBottomSilhouette(silhouette) ? "Bottoms, laid flat" : "Top, laid flat"
      }
    >
      <path
        d={shape.path}
        fill="none"
        stroke="var(--fg3)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GarmentHint({
  dimension,
  silhouette,
  size = 96,
}: {
  dimension: Dimension;
  silhouette: Silhouette;
  size?: number;
}) {
  const shape = SILHOUETTES[silhouette];
  const { x1, y1, x2, y2 } = dimension.hint;

  return (
    <svg
      viewBox={shape.viewBox}
      width={size}
      height={size * ASPECT[silhouette]}
      className="shrink-0"
      role="img"
      aria-label={dimension.guide}
    >
      <path
        d={shape.path}
        fill="none"
        stroke="var(--fg3)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="var(--fg)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {[
        [x1, y1],
        [x2, y2],
      ].map(([x, y]) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r={2.5}
          fill="var(--bg)"
          stroke="var(--fg)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
