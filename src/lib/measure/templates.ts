import type {
  categoryEnum,
  conventionEnum,
  layerSlotEnum,
  measurementKeyEnum,
  photoViewEnum,
} from "@/db/schema";

export type Category = (typeof categoryEnum.enumValues)[number];
export type MeasurementKey = (typeof measurementKeyEnum.enumValues)[number];
export type Convention = (typeof conventionEnum.enumValues)[number];
export type LayerSlot = (typeof layerSlotEnum.enumValues)[number];
export type PhotoView = (typeof photoViewEnum.enumValues)[number];

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

type TopSilhouette = "top" | "long_top" | "vest";

type TopDefinition = Omit<Dimension, "hint" | "seed"> & {
  seed: Partial<Record<TopSilhouette, HandleSeed>> & { top: HandleSeed };
  hints: Partial<Record<TopSilhouette, Hint>> & { top: Hint };
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
    hints: {
      top: { x1: 23, y1: 43, x2: 77, y2: 43, lx: 56, ly: 52, anchor: "middle" },
      long_top: {
        x1: 23,
        y1: 42,
        x2: 77,
        y2: 42,
        lx: 56,
        ly: 51,
        anchor: "middle",
      },
      vest: {
        x1: 23,
        y1: 47,
        x2: 77,
        y2: 47,
        lx: 62,
        ly: 56,
        anchor: "middle",
      },
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
    hints: {
      top: { x1: 23, y1: 15, x2: 77, y2: 15, lx: 50, ly: 3, anchor: "middle" },
      long_top: {
        x1: 28,
        y1: 15,
        x2: 72,
        y2: 15,
        lx: 50,
        ly: 3,
        anchor: "middle",
      },
      vest: { x1: 29, y1: 15, x2: 71, y2: 15, lx: 50, ly: 3, anchor: "middle" },
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
    hints: {
      top: { x1: 77, y1: 15, x2: 98, y2: 30, lx: 100, ly: 27, anchor: "start" },
      long_top: {
        x1: 72,
        y1: 15,
        x2: 105,
        y2: 86,
        lx: 94,
        ly: 45,
        anchor: "start",
      },
      // No vest hint: a vest has no sleeve, and the template omits it.
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
    hints: {
      top: { x1: 37, y1: 10, x2: 37, y2: 92, lx: 43, ly: 66, anchor: "start" },
      long_top: {
        x1: 42,
        y1: 10,
        x2: 42,
        y2: 88,
        lx: 48,
        ly: 68,
        anchor: "start",
      },
      vest: {
        x1: 38,
        y1: 10,
        x2: 38,
        y2: 92,
        lx: 43,
        ly: 72,
        anchor: "start",
      },
    },
    guide:
      "From the highest point of the shoulder, beside the collar, straight down to the bottom hem.",
  },
];

/** The dimensions a top-shaped silhouette takes, with the hints drawn for that shape. */
function topsFor(silhouette: TopSilhouette): Dimension[] {
  const out: Dimension[] = [];
  for (const { hints, seed, ...rest } of TOP_DEFINITIONS) {
    const hint = hints[silhouette];
    if (!hint) continue;
    out.push({ ...rest, hint, seed: seed[silhouette] ?? seed.top });
  }
  return out;
}

const TOPS = topsFor("top");
const LONG_TOPS = topsFor("long_top");
const VESTS = topsFor("vest");

type BottomSilhouette = "bottom" | "shorts";

type BottomDefinition = Omit<Dimension, "hint" | "seed"> & {
  seed: Partial<Record<BottomSilhouette, HandleSeed>> & { bottom: HandleSeed };
  hints: Record<BottomSilhouette, Hint>;
};

/**
 * Shorts take exactly the trouser dimensions; only the drawing and the
 * seeding differ, because the crotch sits about halfway down a pair of
 * shorts and a third of the way down a pair of trousers.
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
    hints: {
      bottom: { x1: 27, y1: 6, x2: 73, y2: 6, lx: 50, ly: 0, anchor: "middle" },
      shorts: { x1: 27, y1: 6, x2: 73, y2: 6, lx: 50, ly: 0, anchor: "middle" },
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
    hints: {
      bottom: { x1: 27, y1: 6, x2: 24, y2: 99, lx: 20, ly: 55, anchor: "end" },
      shorts: { x1: 27, y1: 6, x2: 22, y2: 60, lx: 18, ly: 35, anchor: "end" },
    },
    guide:
      "The full length: down the outside of one leg, from the top of the waistband to the bottom of the leg.",
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
    // Drawn on the right leg: the left already carries outseam and leg
    // opening, and three labels on one leg collide.
    hints: {
      bottom: {
        x1: 50,
        y1: 38,
        x2: 54,
        y2: 99,
        lx: 60,
        ly: 80,
        anchor: "start",
      },
      shorts: {
        x1: 50,
        y1: 38,
        x2: 53,
        y2: 60,
        lx: 58,
        ly: 52,
        anchor: "start",
      },
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
    hints: {
      bottom: {
        x1: 50,
        y1: 6,
        x2: 50,
        y2: 38,
        lx: 55,
        ly: 33,
        anchor: "start",
      },
      shorts: {
        x1: 50,
        y1: 6,
        x2: 50,
        y2: 38,
        lx: 55,
        ly: 30,
        anchor: "start",
      },
    },
    guide:
      "Up the fly, from the crotch seam to the top of the front waistband.",
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
    hints: {
      bottom: {
        x1: 24,
        y1: 99,
        x2: 46,
        y2: 99,
        lx: 35,
        ly: 108,
        anchor: "middle",
      },
      shorts: {
        x1: 22,
        y1: 60,
        x2: 47,
        y2: 60,
        lx: 35,
        ly: 69,
        anchor: "middle",
      },
    },
    guide: "Straight across the very bottom of one leg. Edge to edge.",
  },
];

function bottomsFor(silhouette: BottomSilhouette): Dimension[] {
  return BOTTOM_DEFINITIONS.map(({ hints, seed, ...rest }) => ({
    ...rest,
    hint: hints[silhouette],
    seed: seed[silhouette] ?? seed.bottom,
  }));
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
 * Sleeve length is part of the name wherever a garment comes in both
 * (henley and short sleeve henley, shirt and short sleeve shirt), because it
 * decides the drawing and where the sleeve pin starts. A long-sleeve henley
 * measured as a short-sleeve top seeds pit to pit cuff to cuff.
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
  short_sleeve_henley: "top",
  short_sleeve_shirt: "top",
  long_sleeve: "long_top",
  henley: "long_top",
  shirt: "long_top",
  overshirt: "long_top",
  turtleneck: "long_top",
  sweater: "long_top",
  crewneck: "long_top",
  hoodie: "long_top",
  fleece: "long_top",
  cardigan: "long_top",
  tank: "vest",
  vest: "vest",
  shell: "long_top",
  chore_jacket: "long_top",
  blazer: "long_top",
  coat: "long_top",
  parka: "long_top",
  trousers: "bottom",
  chinos: "bottom",
  jeans: "bottom",
  sweatpants: "bottom",
  shorts: "shorts",
  sweat_shorts: "shorts",
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
  short_sleeve_henley: "top",
  short_sleeve_shirt: "top",
  long_sleeve: "top",
  henley: "top",
  shirt: "top",
  overshirt: "outerwear",
  turtleneck: "top",
  sweater: "top",
  crewneck: "top",
  hoodie: "top",
  fleece: "outerwear",
  cardigan: "top",
  tank: "top",
  vest: "top",
  shell: "outerwear",
  chore_jacket: "outerwear",
  blazer: "outerwear",
  coat: "outerwear",
  parka: "outerwear",
  trousers: "bottom",
  chinos: "bottom",
  jeans: "bottom",
  sweatpants: "bottom",
  shorts: "bottom",
  sweat_shorts: "bottom",
  shoe: null,
  hat: null,
};

export function groupFor(category: Category): Group | null {
  return GROUP_BY_CATEGORY[category];
}

/** Tops split by sleeve, which is to say by the shape they are measured as. */
export const TOP_TYPES: { silhouette: Silhouette; label: string }[] = [
  { silhouette: "top", label: "Short sleeve" },
  { silhouette: "long_top", label: "Long sleeve" },
  { silhouette: "vest", label: "Sleeveless" },
];

/** Every category in a group, optionally narrowed to one shape, in list order. */
export function categoriesIn(group: Group, silhouette?: Silhouette): Category[] {
  return (Object.keys(CATEGORY_LABELS) as Category[]).filter(
    (c) =>
      GROUP_BY_CATEGORY[c] === group &&
      (silhouette === undefined || SILHOUETTE_BY_CATEGORY[c] === silhouette),
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

/** Trousers and shorts are one group to the closet and the add flow. */
export function isBottomSilhouette(silhouette: Silhouette | null): boolean {
  return silhouette === "bottom" || silhouette === "shorts";
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
  henley: "base",
  short_sleeve_henley: "base",
  long_sleeve: "base",
  tank: "base",
  shirt: "mid",
  short_sleeve_shirt: "mid",
  overshirt: "mid",
  turtleneck: "mid",
  sweater: "mid",
  crewneck: "mid",
  hoodie: "mid",
  fleece: "mid",
  cardigan: "mid",
  vest: "mid",
  // The one type that fills the shell slot: the waterproof or windproof
  // layer that goes over everything.
  shell: "shell",
  chore_jacket: "outer",
  blazer: "outer",
  coat: "outer",
  parka: "outer",
  trousers: "bottom",
  chinos: "bottom",
  jeans: "bottom",
  sweatpants: "bottom",
  shorts: "bottom",
  sweat_shorts: "bottom",
  shoe: "footwear",
  hat: "headwear",
};

/** Also the order categories are offered in: most-owned first within each shape. */
export const CATEGORY_LABELS: Record<Category, string> = {
  tshirt: "T-shirt",
  polo: "Polo",
  short_sleeve_henley: "Short sleeve henley",
  short_sleeve_shirt: "Short sleeve shirt",
  long_sleeve: "Long sleeve tee",
  shirt: "Shirt",
  henley: "Henley",
  sweater: "Sweater",
  turtleneck: "Turtleneck",
  cardigan: "Cardigan",
  crewneck: "Crewneck",
  hoodie: "Hoodie",
  tank: "Tank",
  vest: "Vest",
  shell: "Shell",
  chore_jacket: "Chore jacket",
  overshirt: "Overshirt",
  fleece: "Fleece",
  blazer: "Blazer",
  coat: "Coat",
  parka: "Parka",
  jeans: "Jeans",
  trousers: "Trousers",
  chinos: "Chinos",
  sweatpants: "Sweatpants",
  shorts: "Shorts",
  sweat_shorts: "Sweat shorts",
  shoe: "Shoe",
  hat: "Hat",
};
