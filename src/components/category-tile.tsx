import { GarmentOutline } from "@/components/garment-hint";
import {
  CATEGORY_LABELS,
  silhouetteFor,
  type Category,
} from "@/lib/measure/templates";

/**
 * One garment type to pick: its flat drawing over its name. The drawing is
 * what does the explaining — a henley's placket, a chore coat's pockets —
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
  const silhouette = silhouetteFor(category);
  return (
    <button
      type="button"
      className="chip h-full w-full flex-col justify-start gap-3 px-2 pt-4 pb-3"
      aria-pressed={selected}
      onClick={onSelect}
    >
      {/* The name is right under it; the drawing adds nothing to read aloud. */}
      <span className="block h-20 w-20" aria-hidden>
        {silhouette ? (
          <GarmentOutline silhouette={silhouette} category={category} fill />
        ) : null}
      </span>
      <span className="text-center leading-tight">
        {CATEGORY_LABELS[category]}
      </span>
    </button>
  );
}

/** The grid the tiles sit in, shared by the add and edit forms. */
export const CATEGORY_GRID =
  "grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5";
