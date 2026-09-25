import {
  CATEGORY_LABELS,
  isBottomSilhouette,
  type Category,
  type Silhouette,
} from "@/lib/measure/templates";
import { SILHOUETTES, drawingFor } from "@/components/garment-drawings";

export { SILHOUETTES };

/**
 * The garment drawn flat: edge, then its details lighter, then collars and
 * lapels on top. An SVG group, so the diagram can put measurement lines
 * over it and the icon can use it bare.
 *
 * Every stroke is a hairline in screen pixels (`vectorEffect`) at any size.
 */
export function GarmentFigure({
  silhouette,
  category,
}: {
  silhouette: Silhouette;
  /** Draws that category's collar, pockets and seams; the base without it. */
  category?: Category | null;
}) {
  const { path, under, over, details } = drawingFor(silhouette, category);
  return (
    <g
      fill="none"
      strokeWidth={1}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d={path} stroke="var(--fg3)" vectorEffect="non-scaling-stroke" />
      {under ? (
        <path
          d={under}
          fill="var(--bg)"
          stroke="var(--fg3)"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {/* Lighter than the edge so the shape reads first and a measurement
          line never competes with a seam. */}
      <path
        d={details}
        stroke="var(--fg3)"
        strokeOpacity={0.6}
        vectorEffect="non-scaling-stroke"
      />
      {over ? (
        <path
          d={over}
          fill="var(--bg)"
          stroke="var(--fg3)"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </g>
  );
}

/**
 * The garment with no dimension on it: the icon on the add form's type
 * buttons, and at capture the reminder of which shape to lay out.
 */
export function GarmentOutline({
  silhouette,
  category,
  size = 72,
  fill = false,
}: {
  silhouette: Silhouette;
  category?: Category | null;
  size?: number;
  /** Fill the parent box instead of a fixed width; the shape stays centred. */
  fill?: boolean;
}) {
  const shape = SILHOUETTES[silhouette];
  const label = category
    ? CATEGORY_LABELS[category]
    : isBottomSilhouette(silhouette)
      ? "Bottoms, laid flat"
      : "Top, laid flat";
  return (
    <svg
      viewBox={shape.viewBox}
      width={fill ? "100%" : size}
      height={fill ? "100%" : size * shape.aspect}
      className="shrink-0 overflow-visible"
      role="img"
      aria-label={label}
    >
      <GarmentFigure silhouette={silhouette} category={category} />
    </svg>
  );
}
