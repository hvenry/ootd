import type { Layout } from "@/lib/homography/sheet";
import type { Category, PhotoView } from "@/lib/measure/templates";

/**
 * One photograph an item needs before it is in the closet.
 *
 * `markers` is what must be in frame: the layouts it may be solved on, or
 * null for a shot taken off the markers entirely, which has no scale and is
 * never measured. Off-marker shots of a shoe are for the image model, which
 * mirrors one fully seen shoe into a pair rather than guessing a hidden side
 * (docs/footwear-accessories.md).
 */
export type Shot = {
  view: PhotoView;
  /** Sentence case, the step's name. */
  label: string;
  /** How to take it, in one line under the name. */
  instruction: string;
  markers: readonly Layout[] | null;
};

/** How an item is photographed. Clothes lie flat; a shoe is a solid. */
export type ShotKind = "garment" | "footwear" | "belt";

const GARMENT_SHOTS: Shot[] = [
  {
    view: "front",
    label: "Front",
    instruction: "Flat, inside the four markers, shot straight down.",
    markers: ["rig", "a3"],
  },
  {
    view: "back",
    label: "Back",
    instruction: "Flat, inside the four markers, shot straight down.",
    markers: ["rig", "a3"],
  },
];

const FOOTWEAR_SHOTS: Shot[] = [
  {
    view: "top",
    label: "Top down",
    instruction:
      "One shoe, lengthwise down the middle of the A3 sheet, toe to the top. Shoot straight down, from high up on the 2× lens if you have one.",
    markers: ["a3"],
  },
  {
    view: "outer",
    label: "Outer side",
    instruction: "The same shoe from its outside, camera at floor level.",
    markers: null,
  },
  {
    view: "inner",
    label: "Inner side",
    instruction: "From the inside, camera at floor level.",
    markers: null,
  },
  {
    view: "toe",
    label: "Toe",
    instruction: "From the front, about 45° down, so the opening shows.",
    markers: null,
  },
  {
    view: "heel",
    label: "Heel",
    instruction: "From the back, about 45° down.",
    markers: null,
  },
];

const BELT_SHOTS: Shot[] = [
  {
    view: "front",
    label: "Belt",
    instruction:
      "Laid flat in a U inside the four markers, buckle at the top, shot straight down.",
    markers: ["rig", "a3"],
  },
];

const SHOTS: Record<ShotKind, Shot[]> = {
  garment: GARMENT_SHOTS,
  footwear: FOOTWEAR_SHOTS,
  belt: BELT_SHOTS,
};

/**
 * Which picture stands for the item in the closet grid. The outer side is
 * how a shoe is recognised; the top-down shot is only there for its scale.
 */
const COVER: Record<ShotKind, PhotoView> = {
  garment: "front",
  footwear: "outer",
  belt: "front",
};

/** What the close-ups step suggests first. */
export const CLOSEUP_HINT: Record<ShotKind, string | null> = {
  garment: null,
  footwear: "The size label inside the tongue is worth one.",
  belt: "Take the buckle, as Hardware.",
};

export function shotKindFor(category: Category): ShotKind {
  if (category === "shoe" || category === "boot") return "footwear";
  if (category === "belt") return "belt";
  return "garment";
}

export function shotsFor(category: Category): Shot[] {
  return SHOTS[shotKindFor(category)];
}

export function shotFor(category: Category, view: PhotoView): Shot | undefined {
  return shotsFor(category).find((s) => s.view === view);
}

export function coverViewFor(category: Category): PhotoView {
  return COVER[shotKindFor(category)];
}

/** The required views not yet shot, in the order they are taken. */
export function missingViews(
  category: Category,
  views: readonly string[],
): PhotoView[] {
  return shotsFor(category)
    .map((s) => s.view)
    .filter((v) => !views.includes(v));
}

/** The pager's word for a non-detail photo. */
export function viewLabel(category: Category, view: PhotoView): string {
  return shotFor(category, view)?.label ?? view;
}

/**
 * Where a view sorts on the item page: the cover first, as in the closet,
 * then the other steps in order, then close-ups last.
 */
export function viewRank(category: Category, view: PhotoView): number {
  if (view === coverViewFor(category)) return -1;
  const index = shotsFor(category).findIndex((s) => s.view === view);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
