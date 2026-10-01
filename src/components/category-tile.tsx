import { GarmentOutline } from "@/components/garment-hint";
import {
  CATEGORY_LABELS,
  silhouetteFor,
  type Category,
} from "@/lib/measure/templates";

/**
 * Things that are not laid flat have no silhouette to measure against, only
 * a picture to pick them by: a side view, toe to the right, as they are
 * photographed.
 */
const ITEM_DRAWINGS: Partial<Record<Category, { edge: string; details: string }>> = {
  // A derby: low collar, the quarter seam sweeping down to a stacked heel.
  shoe: {
    edge: "M6,42 C4,50 4,58 5,66 M6,42 C16,47 30,46 42,35 L60,47 C72,52 86,54 93,57 C97,59 97,62 96,64 M5,66 C40,66 80,66 96,64 M5,66 L4,74 L27,74 L29,71 C52,71 80,70 94,68 L96,64",
    details: "M60,47 C52,52 42,56 34,66",
  },
  // A work boot: tall padded shaft, eyelets up the front, a heavy sole.
  boot: {
    edge: "M14,22 C12,36 12,50 13,64 M14,22 L40,20 C44,19 46,18 49,19 L60,48 C66,53 78,55 85,57 C89,58 91,62 90,66 M13,64 C40,66 70,70 90,67 M13,64 L12,77 L36,77 L38,72 C52,74 76,75 91,72 L90,67",
    details: "M14,28 C24,27 38,25 51,24.5 M13,68 C40,70 70,74 90,71 M49.8,29 m-1.3,0 a1.3,1.3 0 1,0 2.6,0 a1.3,1.3 0 1,0 -2.6,0 M51.7,34 m-1.3,0 a1.3,1.3 0 1,0 2.6,0 a1.3,1.3 0 1,0 -2.6,0 M53.6,39 m-1.3,0 a1.3,1.3 0 1,0 2.6,0 a1.3,1.3 0 1,0 -2.6,0 M55.5,44 m-1.3,0 a1.3,1.3 0 1,0 2.6,0 a1.3,1.3 0 1,0 -2.6,0",
  },
  // Laid straight: the tip end with its holes, the buckle, the keeper.
  belt: {
    edge: "M4,42 L38,42 M4,58 L38,58 M4,42 L4,58 M38,38.5 L55,38.5 L55,61.5 L38,61.5 Z M41,40.5 L52,40.5 L52,59.5 L41,59.5 Z M41,42 L52,42 M41,58 L52,58 M55,42 L58,42 M55,58 L58,58 M58,40 L63,40 L63,60 L58,60 Z M63,42 L96,42 L96,58 L63,58",
    details: "M16,50 m-1.2,0 a1.2,1.2 0 1,0 2.4,0 a1.2,1.2 0 1,0 -2.4,0 M26,50 m-1.2,0 a1.2,1.2 0 1,0 2.4,0 a1.2,1.2 0 1,0 -2.4,0",
  },
};

/** The category's drawing, filling its box: flat garments and the rest. */
export function ItemIcon({ category }: { category: Category }) {
  const silhouette = silhouetteFor(category);
  if (silhouette) {
    return <GarmentOutline silhouette={silhouette} category={category} fill />;
  }
  const drawing = ITEM_DRAWINGS[category];
  if (!drawing) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      className="block h-full w-full"
      fill="none"
      strokeWidth={1}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d={drawing.edge} stroke="var(--fg3)" vectorEffect="non-scaling-stroke" />
      <path
        d={drawing.details}
        stroke="var(--fg3)"
        strokeOpacity={0.6}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * One garment type to pick: its flat drawing over its name. The drawing is
 * what does the explaining — a henley's placket, a trucker's yoke —
 * so the tile carries no description.
 */
export function CategoryTile({
  category,
  selected,
  onSelect,
}: {
  category: Category;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="chip h-full w-full flex-col justify-start gap-3 px-2 pt-4 pb-3"
      aria-pressed={selected}
      onClick={onSelect}
    >
      {/* The name is right under it; the drawing adds nothing to read aloud. */}
      <span className="block h-20 w-20" aria-hidden>
        <ItemIcon category={category} />
      </span>
      <span className="text-center leading-tight">
        {nowrapHyphenated(CATEGORY_LABELS[category])}
      </span>
    </button>
  );
}

/**
 * Browsers break after a hyphen, so a narrow tile set "T-" over "shirt".
 * Hyphenated words are held together; the label still wraps between words.
 * A span rather than a non-breaking hyphen, which not every font carries.
 */
function nowrapHyphenated(label: string): React.ReactNode {
  return label.split(/(\S*-\S*)/).map((part, i) =>
    part.includes("-") ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/** The grid the tiles sit in, shared by the add and edit forms. */
export const CATEGORY_GRID =
  "grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5";
