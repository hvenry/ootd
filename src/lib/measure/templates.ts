import type {
  categoryEnum,
  conventionEnum,
  detailKindEnum,
  layerSlotEnum,
  measurementKeyEnum,
  photoViewEnum,
} from "@/db/schema";

export type Category = (typeof categoryEnum.enumValues)[number];
export type MeasurementKey = (typeof measurementKeyEnum.enumValues)[number];
export type Convention = (typeof conventionEnum.enumValues)[number];
export type LayerSlot = (typeof layerSlotEnum.enumValues)[number];
export type PhotoView = (typeof photoViewEnum.enumValues)[number];
export type DetailKind = (typeof detailKindEnum.enumValues)[number];

/** In the order they are offered at capture: the label is the one that pays. */
export const DETAIL_KIND_LABELS: Record<DetailKind, string> = {
  label: "Care label",
  fabric: "Fabric",
  print: "Print",
  hardware: "Hardware",
  other: "Other",
};
export const DETAIL_KINDS = Object.keys(DETAIL_KIND_LABELS) as DetailKind[];

/**
 * How to seed the two handles from the cutout mask before the user touches
 * anything. The human then picks the semantic point — which is the pit, where
 * the shoulder seam ends — and that is where the accuracy comes from. It is
 * why this is not automatic landmarking: published auto-landmarking runs
 * ~1.27cm MAE, which is ±2.1cm on a 52cm pit-to-pit, useless for fit.
 */
export type HandleSeed =
  /** Widest horizontal span of the mask within a vertical band. */
  | { kind: "widest_chord"; from: number; to: number }
  /** A horizontal cut across the mask at a fraction of its height. */
  | { kind: "horizontal"; at: number }
  /** Top-centre to bottom-centre of the mask. */
  | { kind: "vertical"; from: number; to: number }
  /** A diagonal, for sleeves: shoulder point out to the cuff. */
  | {
      kind: "diagonal";
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
    };

export type Hint = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lx: number;
  ly: number;
  anchor: "start" | "middle" | "end";
};

export type Dimension = {
  key: MeasurementKey;
  /** Sentence case, what the user reads. */
  label: string;
  /** Mono prefix for the meta block: P2P 530. */
  prefix: string;
  /**
   * `is_doubled` and `convention` are stored on every row because brands
   * disagree on both and the disagreement is invisible in the number itself.
   *
   * They are no longer *asked*, though. A picker labelled "edge to edge /
   * seam to seam" is a vocabulary quiz in the middle of a measurement, and
   * the honest answer is whatever the person actually did — which is whatever
   * the guide told them to do. So the guide sentence and the hint sketch
   * define the convention, and these record it.
   */
  defaultConvention: Convention;
  defaultIsDoubled: boolean;
  /** Width doubled approximates circumference only when the fabric is stable. */
  doublingApproximatesCircumference: boolean;
  seed: HandleSeed;
  optional: boolean;
  /**
   * Where the two points go on the hint sketch, in that silhouette's own
   * coordinates. A name like "front rise" means nothing until you have seen
   * which two points it runs between.
   *
   * `lx`/`ly`/`anchor` place this dimension's value on the review diagram.
   * They are authored rather than derived: with ten dimensions on four
   * silhouettes, every automatic rule collides somewhere, and a collision
   * is exactly what makes the diagram unreadable.
   */
  hint: Hint;
  /** One sentence naming both endpoints. This *is* the convention, in words. */
  guide: string;
};

/** Where a figure or a pin number sits on the sketch. */
type LabelAt = Pick<Hint, "lx" | "ly" | "anchor">;

/**
 * One pin on a shared layout: where it sits on the sketch, where its number
 * goes, and the sentence that says which point on the cloth it marks.
 */
export type Pin = { x: number; y: number; guide: string } & LabelAt;

/**
 * A garment measured by placing every point once, rather than two points
 * per dimension.
 *
 * Dimensions share their ends: on trousers the waist's left corner is where
 * the outseam starts, on a top the shoulder seam's end is where the sleeve
 * starts. Pinned a pair at a time, the same point was placed twice and never
 * quite the same place twice, so two numbers disagreed about where the
 * garment begins. Each point placed once cannot disagree with itself.
 */
export type PinLayout = {
  pins: Pin[];
  /**
   * The two pins each dimension runs between, indexes into `pins`, in the
   * order the row stores them as p1 and p2.
   */
  pairs: Partial<Record<MeasurementKey, [number, number]>>;
  /** How the pins are placed from the cutout before anyone touches them. */
  seed: { kind: "bottom"; crotchAt: number } | { kind: "top"; sleeved: boolean };
  /**
   * A pin held square to a line: `pin` only moves along the line through
   * `from` at right angles to `across`. A body length is measured straight
   * down the garment, and a hem pin free to wander sideways makes it a
   * diagonal. Square to the shoulders rather than to the photo, so a
   * garment laid a little crooked is still measured along itself.
   */
  plumb?: { pin: number; from: number; across: [number, number] };
};

function pinsFrom(
  guides: string[],
  points: [number, number, number, number, Hint["anchor"]][],
): Pin[] {
  return points.map(([x, y, lx, ly, anchor], i) => ({
    x,
    y,
    lx,
    ly,
    anchor,
    guide: guides[i],
  }));
}

/**
 * Round the left leg: 1–2 waist, 1–3 outseam, 3–4 leg opening, 4–5 inseam,
 * 5–6 front rise. Inseam and front rise are stored crotch-first and
 * waist-first, as they were when they were pinned a pair at a time.
 */
const BOTTOM_PAIRS: PinLayout["pairs"] = {
  waist: [0, 1],
  outseam: [0, 2],
  leg_opening: [2, 3],
  inseam: [4, 3],
  front_rise: [5, 4],
};

const BOTTOM_PIN_GUIDES = [
  "Top of the waistband, left edge.",
  "Top of the waistband, right edge.",
  "Bottom of the left leg, outside edge.",
  "Bottom of the left leg, inside edge.",
  "The crotch seam, where the legs meet.",
  "Top of the front waistband, at the fly.",
];

/**
 * 1–2 pit to pit, 3–4 shoulder, 3–5 sleeve, 6–7 body length, so the list
 * keeps pit to pit first and still counts up. The sleeve is the left one,
 * as the leg is on trousers.
 */
const SLEEVED_PAIRS: PinLayout["pairs"] = {
  chest: [0, 1],
  shoulder: [2, 3],
  sleeve: [2, 4],
  body_length: [5, 6],
};

const SLEEVED_PIN_GUIDES = [
  "Left armpit, at the bottom of the armhole.",
  "Right armpit.",
  "Left shoulder point, where the shoulder seam meets the sleeve.",
  "Right shoulder point.",
  "End of the left sleeve, on its top edge.",
  "High point of the shoulder, beside the collar.",
  "The bottom hem. It stays straight below 6.",
];

const SLEEVELESS_PAIRS: PinLayout["pairs"] = {
  chest: [0, 1],
  shoulder: [2, 3],
  body_length: [4, 5],
};

const SLEEVELESS_PIN_GUIDES = [
  "Left armpit, at the bottom of the armhole.",
  "Right armpit.",
  "Left shoulder, at the outer end of the shoulder seam.",
  "Right shoulder.",
  "High point of the shoulder, beside the neck.",
  "The bottom hem. It stays straight below 5.",
];

/* Numbers sit outside the points they mark, and clear of the figures: the
   waist's and shoulder's values are over the middle of the top edge, the leg
   opening's under the middle of the hem. */
const PIN_LAYOUTS: Partial<Record<Silhouette, PinLayout>> = {
  top: {
    pins: pinsFrom(SLEEVED_PIN_GUIDES, [
      [23, 43, 20.5, 47, "end"],
      [77, 43, 79.5, 47, "start"],
      [23, 15, 20.5, 13, "end"],
      [77, 15, 79.5, 13, "start"],
      [2, 30, -0.5, 34, "end"],
      [37, 10, 35, 7.5, "end"],
      [37, 92, 39.5, 98.5, "start"],
    ]),
    pairs: SLEEVED_PAIRS,
    seed: { kind: "top", sleeved: true },
    plumb: { pin: 6, from: 5, across: [2, 3] },
  },
  long_top: {
    pins: pinsFrom(SLEEVED_PIN_GUIDES, [
      [23, 42, 20.5, 46, "end"],
      [77, 42, 79.5, 46, "start"],
      [28, 15, 25.5, 13, "end"],
      [72, 15, 74.5, 13, "start"],
      [-5, 86, -7.5, 91, "end"],
      [42, 10, 40, 7.5, "end"],
      [42, 88, 44.5, 94.5, "start"],
    ]),
    pairs: SLEEVED_PAIRS,
    seed: { kind: "top", sleeved: true },
    plumb: { pin: 6, from: 5, across: [2, 3] },
  },
  vest: {
    pins: pinsFrom(SLEEVELESS_PIN_GUIDES, [
      [23, 47, 20.5, 51, "end"],
      [77, 47, 79.5, 51, "start"],
      [29, 15, 26.5, 13, "end"],
      [71, 15, 73.5, 13, "start"],
      [38, 10, 36, 7.5, "end"],
      [38, 92, 40.5, 98.5, "start"],
    ]),
    pairs: SLEEVELESS_PAIRS,
    seed: { kind: "top", sleeved: false },
    plumb: { pin: 5, from: 4, across: [2, 3] },
  },
  bottom: {
    pins: pinsFrom(BOTTOM_PIN_GUIDES, [
      [27, 6, 24.5, 4, "end"],
      [73, 6, 75.5, 4, "start"],
      [24, 99, 21.5, 104, "end"],
      [46, 99, 48.5, 104, "start"],
      [50, 38, 47, 42, "end"],
      [50, 6, 47.5, 13, "end"],
    ]),
    pairs: BOTTOM_PAIRS,
    seed: { kind: "bottom", crotchAt: 0.34 },
  },
  shorts: {
    pins: pinsFrom(BOTTOM_PIN_GUIDES, [
      [27, 6, 24.5, 4, "end"],
      [73, 6, 75.5, 4, "start"],
      [22, 60, 19.5, 65, "end"],
      [47, 60, 49.5, 65, "start"],
      [50, 38, 47, 42, "end"],
      [50, 6, 47.5, 13, "end"],
    ]),
    pairs: BOTTOM_PAIRS,
    seed: { kind: "bottom", crotchAt: 0.55 },
  },
};

/** The shared-pin layout a silhouette is measured with, if it has one. */
export function pinLayoutFor(silhouette: Silhouette | null): PinLayout | null {
  return (silhouette && PIN_LAYOUTS[silhouette]) ?? null;
}

/** A dimension's sketch line, drawn between the very pins that measure it. */
function lineFor(
  layout: PinLayout,
  key: MeasurementKey,
  label: LabelAt,
): Hint {
  const [a, b] = layout.pairs[key]!;
  const p1 = layout.pins[a];
  const p2 = layout.pins[b];
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, ...label };
}

type TopSilhouette = "top" | "long_top" | "vest";

type TopDefinition = Omit<Dimension, "hint" | "seed"> & {
  seed: Partial<Record<TopSilhouette, HandleSeed>> & { top: HandleSeed };
  /** Where the value goes; the line itself runs between the dimension's pins. */
  labels: Partial<Record<TopSilhouette, LabelAt>> & { top: LabelAt };
};

const TOP_DEFINITIONS: TopDefinition[] = [
  {
    key: "chest",
    label: "Pit to pit",
    prefix: "P2P",
    defaultConvention: "edge_to_edge",
    defaultIsDoubled: false,
    doublingApproximatesCircumference: true,
    seed: {
      top: { kind: "widest_chord", from: 0.18, to: 0.38 },
      // Long sleeves hang beside the body, so the widest chord in the chest
      // band would run cuff to cuff. Cut straight across instead.
      long_top: { kind: "horizontal", at: 0.3 },
      vest: { kind: "widest_chord", from: 0.18, to: 0.38 },
    },
    optional: false,
    labels: {
      top: { lx: 56, ly: 52, anchor: "middle" },
      long_top: { lx: 56, ly: 51, anchor: "middle" },
      vest: { lx: 62, ly: 56, anchor: "middle" },
    },
    guide:
      "Straight across from one armpit to the other, at the bottom of each armhole. Outer edge to outer edge.",
  },
  {
    key: "shoulder",
    label: "Shoulder",
    prefix: "SH",
    defaultConvention: "seam_to_seam",
    defaultIsDoubled: false,
    doublingApproximatesCircumference: false,
    seed: { top: { kind: "horizontal", at: 0.1 } },
    optional: false,
    labels: {
      top: { lx: 50, ly: 3, anchor: "middle" },
      long_top: { lx: 50, ly: 3, anchor: "middle" },
      vest: { lx: 50, ly: 3, anchor: "middle" },
    },
    guide:
      "Across the top, from where one shoulder seam meets the sleeve to the same point on the other side.",
  },
  {
    key: "sleeve",
    label: "Sleeve",
    prefix: "SL",
    defaultConvention: "seam_to_seam",
    defaultIsDoubled: false,
    doublingApproximatesCircumference: false,
    seed: {
      top: { kind: "diagonal", fromX: 0.26, fromY: 0.07, toX: 0.05, toY: 0.17 },
      long_top: {
        kind: "diagonal",
        fromX: 0.26,
        fromY: 0.07,
        toX: 0.02,
        toY: 0.62,
      },
    },
    optional: false,
    // On the left sleeve, where the pins put it; the value sits off the
    // sleeve's outer edge.
    labels: {
      top: { lx: 0, ly: 27, anchor: "end" },
      long_top: { lx: 6, ly: 45, anchor: "end" },
      // No vest label: a vest has no sleeve, and the template omits it.
    },
    // Along the top, not the underarm: the underarm seam is shorter, it is
    // the one people reach for by accident, and the two differ by enough to
    // matter against a size chart.
    guide:
      "The top edge of the sleeve only: from the shoulder seam out to the end of the sleeve. Not the underarm seam.",
  },
  {
    key: "body_length",
    label: "Body length",
    prefix: "BL",
    defaultConvention: "hps_to_hem",
    defaultIsDoubled: false,
    doublingApproximatesCircumference: false,
    seed: { top: { kind: "vertical", from: 0.02, to: 0.98 } },
    optional: false,
    labels: {
      top: { lx: 43, ly: 66, anchor: "start" },
      long_top: { lx: 48, ly: 68, anchor: "start" },
      vest: { lx: 43, ly: 72, anchor: "start" },
    },
    guide:
      "From the highest point of the shoulder, beside the collar, straight down to the bottom hem.",
  },
];

/** The dimensions a top-shaped silhouette takes, with the hints drawn for that shape. */
function topsFor(silhouette: TopSilhouette): Dimension[] {
  const out: Dimension[] = [];
  const layout = PIN_LAYOUTS[silhouette]!;
  for (const { labels, seed, ...rest } of TOP_DEFINITIONS) {
    const label = labels[silhouette];
    if (!label) continue;
    out.push({
      ...rest,
      hint: lineFor(layout, rest.key, label),
      seed: seed[silhouette] ?? seed.top,
    });
  }
  return out;
}

const TOPS = topsFor("top");
const LONG_TOPS = topsFor("long_top");
const VESTS = topsFor("vest");

type BottomSilhouette = "bottom" | "shorts";

type BottomDefinition = Omit<Dimension, "hint" | "seed"> & {
  seed: Partial<Record<BottomSilhouette, HandleSeed>> & { bottom: HandleSeed };
  /** Where the value goes; the line itself runs between the dimension's pins. */
  labels: Record<BottomSilhouette, LabelAt>;
};

/**
 * Shorts take exactly the trouser dimensions; only the drawing and the
 * seeding differ, because the crotch sits about halfway down a pair of
 * shorts and a third of the way down a pair of trousers.
 *
 * In the order the pins go round the leg, so the list reads 1–2, 1–3, 3–4,
 * 4–5, 5–6.
 */
const BOTTOM_DEFINITIONS: BottomDefinition[] = [
  {
    key: "waist",
    label: "Waist",
    prefix: "W",
    defaultConvention: "back_waistband",
    defaultIsDoubled: false,
    doublingApproximatesCircumference: true,
    seed: { bottom: { kind: "horizontal", at: 0.02 } },
    optional: false,
    labels: {
      bottom: { lx: 50, ly: 0, anchor: "middle" },
      shorts: { lx: 50, ly: 0, anchor: "middle" },
    },
    guide:
      "Straight across the top of the waistband, edge to edge, with the waistband lying flat.",
  },
  {
    key: "outseam",
    label: "Outseam",
    prefix: "OUT",
    defaultConvention: "seam_to_seam",
    defaultIsDoubled: false,
    doublingApproximatesCircumference: false,
    seed: {
      bottom: {
        kind: "diagonal",
        fromX: 0.06,
        fromY: 0.02,
        toX: 0.07,
        toY: 0.98,
      },
    },
    optional: false,
    labels: {
      bottom: { lx: 20, ly: 55, anchor: "end" },
      shorts: { lx: 18, ly: 35, anchor: "end" },
    },
    guide:
      "The full length: down the outside of one leg, from the top of the waistband to the bottom of the leg.",
  },
  {
    key: "leg_opening",
    label: "Leg opening",
    prefix: "LO",
    defaultConvention: "edge_to_edge",
    defaultIsDoubled: false,
    doublingApproximatesCircumference: true,
    seed: { bottom: { kind: "horizontal", at: 0.97 } },
    optional: false,
    labels: {
      bottom: { lx: 35, ly: 108, anchor: "middle" },
      shorts: { lx: 35, ly: 69, anchor: "middle" },
    },
    guide: "Straight across the very bottom of one leg. Edge to edge.",
  },
  {
    key: "inseam",
    label: "Inseam",
    prefix: "IN",
    defaultConvention: "seam_to_seam",
    defaultIsDoubled: false,
    doublingApproximatesCircumference: false,
    seed: {
      bottom: { kind: "vertical", from: 0.34, to: 0.98 },
      shorts: { kind: "vertical", from: 0.55, to: 0.98 },
    },
    optional: false,
    // The line is on the left leg's inside edge, sharing pin 4 with the leg
    // opening; the figure goes across the gap, on the right leg, where the
    // left leg's other two figures are not.
    labels: {
      bottom: { lx: 54, ly: 80, anchor: "start" },
      shorts: { lx: 54, ly: 54, anchor: "start" },
    },
    guide:
      "Down the inside of one leg, from the crotch seam to the bottom of the leg.",
  },
  {
    key: "front_rise",
    label: "Front rise",
    prefix: "FR",
    defaultConvention: "seam_to_seam",
    defaultIsDoubled: false,
    doublingApproximatesCircumference: false,
    seed: {
      bottom: { kind: "vertical", from: 0.02, to: 0.34 },
      shorts: { kind: "vertical", from: 0.02, to: 0.55 },
    },
    optional: false,
    labels: {
      bottom: { lx: 55, ly: 33, anchor: "start" },
      shorts: { lx: 55, ly: 30, anchor: "start" },
    },
    guide:
      "Up the fly, from the crotch seam to the top of the front waistband.",
  },
];

function bottomsFor(silhouette: BottomSilhouette): Dimension[] {
  const layout = PIN_LAYOUTS[silhouette]!;
  return BOTTOM_DEFINITIONS.map(({ labels, seed, ...rest }) => {
    return {
      ...rest,
      hint: lineFor(layout, rest.key, labels[silhouette]),
      seed: seed[silhouette] ?? seed.bottom,
    };
  });
}

const BOTTOMS = bottomsFor("bottom");
const SHORTS = bottomsFor("shorts");

/**
 * The shape a garment is drawn and laid out as. `top`, `long_top` and `vest`
 * share one set of dimensions (less the sleeve on a vest); what differs is
 * where the sleeve line is drawn and how the pins are seeded.
 */
export type Silhouette = "top" | "long_top" | "vest" | "bottom" | "shorts";

/**
 * Which shape each category is measured as — and the reason this is a
 * `Record` over every category rather than two arrays.
 *
 * The shape decides the drawing and where the sleeve pin starts, not the
 * numbers: every sleeved top stores the same four. So a button-up is drawn
 * long-sleeved whether or not it is, and a short-sleeve one is measured by
 * dragging the sleeve pin up from the cuff it was seeded at.
 *
 * A polo, a henley and an oxford take the same four numbers from the same
 * four points as a t-shirt. The categories exist so the closet can be
 * searched and the layer validator can reason about what goes over what;
 * they are deliberately not a reason to fork the template, and a one-off
 * dimension for any of them would be one no brand chart lists and nothing
 * could be compared against.
 *
 * Exhaustive on purpose: adding a category to the enum and forgetting to
 * classify it here is a type error. Listed as arrays, it was a garment that
 * silently offered no measurements at all.
 */
const SILHOUETTE_BY_CATEGORY: Record<Category, Silhouette | null> = {
  tshirt: "top",
  polo: "top",
  long_sleeve: "long_top",
  shirt: "long_top",
  sweater: "long_top",
  sweatshirt: "long_top",
  tank: "vest",
  overshirt: "long_top",
  light_jacket: "long_top",
  heavy_jacket: "long_top",
  denim_jacket: "long_top",
  leather_jacket: "long_top",
  blazer: "long_top",
  vest: "vest",
  pants: "bottom",
  jeans: "bottom",
  sweatpants: "bottom",
  shorts: "shorts",
  // Sized, never measured: a labelled size is the whole record for these.
  shoe: null,
  hat: null,
};

export function silhouetteFor(category: Category): Silhouette | null {
  return SILHOUETTE_BY_CATEGORY[category];
}

/**
 * The first question when adding a garment. Outerwear is measured exactly
 * like a long-sleeve top; it is its own group because that is how a closet
 * is sorted in your head, and because a jacket filed among twelve tops is
 * a jacket nobody finds.
 */
export type Group = "top" | "bottom" | "outerwear";

export const GROUP_LABELS: Record<Group, string> = {
  top: "Tops",
  bottom: "Bottoms",
  outerwear: "Outerwear",
};

const GROUP_BY_CATEGORY: Record<Category, Group | null> = {
  tshirt: "top",
  polo: "top",
  long_sleeve: "top",
  shirt: "top",
  sweater: "top",
  sweatshirt: "top",
  tank: "top",
  overshirt: "outerwear",
  light_jacket: "outerwear",
  heavy_jacket: "outerwear",
  denim_jacket: "outerwear",
  leather_jacket: "outerwear",
  blazer: "outerwear",
  vest: "outerwear",
  pants: "bottom",
  jeans: "bottom",
  sweatpants: "bottom",
  shorts: "bottom",
  shoe: null,
  hat: null,
};

export function groupFor(category: Category): Group | null {
  return GROUP_BY_CATEGORY[category];
}

/** Every category in a group, in list order. */
export function categoriesIn(group: Group): Category[] {
  return (Object.keys(CATEGORY_LABELS) as Category[]).filter(
    (c) => GROUP_BY_CATEGORY[c] === group,
  );
}

/** Tops and bottoms are measured. Shoes and hats take a labelled size instead. */
export function templateFor(category: Category): Dimension[] {
  switch (SILHOUETTE_BY_CATEGORY[category]) {
    case "top":
      return TOPS;
    case "long_top":
      return LONG_TOPS;
    case "vest":
      return VESTS;
    case "bottom":
      return BOTTOMS;
    case "shorts":
      return SHORTS;
    default:
      return [];
  }
}

/** Pants and shorts are one group to the closet and the add flow. */
export function isBottomSilhouette(silhouette: Silhouette | null): boolean {
  return silhouette === "bottom" || silhouette === "shorts";
}

/**
 * Which shared scale the worker draws a garment's tile at. Outerwear sits
 * with the tops: laid flat, a jacket is a top's shape and size.
 */
export function tileScaleFor(category: Category): "top" | "bottom" {
  return isBottomSilhouette(silhouetteFor(category)) ? "bottom" : "top";
}

/** Tops of every sleeve length are one group to the closet and the add flow. */
export function isTopSilhouette(silhouette: Silhouette | null): boolean {
  return (
    silhouette === "top" || silhouette === "long_top" || silhouette === "vest"
  );
}

export function dimensionFor(
  category: Category,
  key: MeasurementKey,
): Dimension | undefined {
  return templateFor(category).find((d) => d.key === key);
}

/**
 * The measurement shown under the image in the closet grid — the one that
 * decides fit, which is why the third line is a number and not a price.
 */
export function governingKey(category: Category): MeasurementKey | null {
  switch (SILHOUETTE_BY_CATEGORY[category]) {
    case "top":
    case "long_top":
    case "vest":
      return "chest";
    case "bottom":
    case "shorts":
      return "waist";
    default:
      return null;
  }
}

export const DEFAULT_LAYER_SLOT: Record<Category, LayerSlot> = {
  tshirt: "base",
  polo: "base",
  long_sleeve: "base",
  tank: "base",
  shirt: "mid",
  sweater: "mid",
  sweatshirt: "mid",
  overshirt: "mid",
  // Light jacket covers shells as well as chore jackets, so it defaults to
  // the outer slot. Garments that were shells before the merge kept the
  // shell slot on their own rows.
  light_jacket: "outer",
  heavy_jacket: "outer",
  denim_jacket: "outer",
  leather_jacket: "outer",
  blazer: "outer",
  // Filed with outerwear, and the puffer it took in goes over everything.
  vest: "outer",
  pants: "bottom",
  jeans: "bottom",
  sweatpants: "bottom",
  shorts: "bottom",
  shoe: "footwear",
  hat: "headwear",
};

/** Also the order categories are offered in within each group. */
export const CATEGORY_LABELS: Record<Category, string> = {
  tshirt: "Short sleeve T-shirt",
  polo: "Polo",
  long_sleeve: "Long sleeve T-shirt",
  shirt: "Button-up shirt",
  sweater: "Sweater",
  sweatshirt: "Sweatshirt",
  tank: "Tank top",
  light_jacket: "Light jacket",
  heavy_jacket: "Heavy jacket",
  denim_jacket: "Denim jacket",
  leather_jacket: "Leather jacket",
  overshirt: "Overshirt",
  blazer: "Blazer",
  vest: "Vest",
  jeans: "Jeans",
  pants: "Pants",
  sweatpants: "Sweatpants",
  shorts: "Shorts",
  shoe: "Shoe",
  hat: "Hat",
};
