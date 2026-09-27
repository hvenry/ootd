import type { Category, Silhouette } from "@/lib/measure/templates";

/**
 * The flat drawings: one base per silhouette, and per category the details
 * that tell a polo from a T-shirt at a glance.
 *
 * The base owns every point a measurement lands on — pits, shoulder points,
 * the high point of the shoulder, cuffs, hem, waist corners, crotch. A
 * category may redraw the neck (a polo's collar, a blazer's lapels) and add
 * whatever sits inside the outline, but never moves one of those points:
 * the hint lines in `lib/measure/templates` are authored against the base,
 * and a pocket is decoration while a moved pit is a wrong diagram.
 */

export type Drawing = {
  /** The garment's edge. */
  path: string;
  /**
   * Pieces behind `over` at outline weight, like a hood behind a collar.
   * A separate layer, because one path cannot hide its own strokes. Drawn
   * before `details`, so detail can sit on a piece behind a collar.
   */
  under: string;
  /**
   * Pieces that lie on top at outline weight — collars, lapels, hoods.
   * Filled with the ground so they hide whatever seam runs beneath them.
   */
  over: string;
  /** Seams, hems, pockets, buttons: drawn lighter than the edge. */
  details: string;
};

export type SilhouetteShape = {
  viewBox: string;
  /** Same shape with room around it for value labels. */
  padded: string;
  /** Height over width of `viewBox`, for fixed-width renders. */
  aspect: number;
  path: string;
  /** The base's details, by part, so a category can swap one out. */
  parts: Record<string, string>;
};

// ---------------------------------------------------------------- helpers

/** A closed circle as path data, for buttons and snaps. */
function circle(cx: number, cy: number, r = 0.9): string {
  return (
    `M${cx + r},${cy} A${r},${r} 0 1,0 ${cx - r},${cy} ` +
    `A${r},${r} 0 1,0 ${cx + r},${cy} `
  );
}

function circles(cx: number, ys: number[], r = 0.9): string {
  return ys.map((y) => circle(cx, y, r)).join("");
}

/** Short vertical strokes: ribbing on a hem, cuff or waistband. */
function ribs(x1: number, x2: number, y1: number, y2: number, step = 2): string {
  let d = "";
  for (let x = x1 + step; x < x2 - step / 2; x += step) {
    d += `M${+x.toFixed(2)},${y1} L${+x.toFixed(2)},${y2} `;
  }
  return d;
}

/**
 * A cable: two strands crossing down a column. The sweater's tell, and
 * the one thing that marks a sweater out from a sweatshirt at icon size.
 */
function cable(x: number, y1: number, y2: number, a = 2.2, h = 4): string {
  let left = `M${x - a},${y1} `;
  let right = `M${x + a},${y1} `;
  // Each half-period, both strands swap sides on an S-curve.
  let side = -1;
  for (let y = y1; y + h <= y2; y += h) {
    const m = y + h / 2;
    const e = y + h;
    left += `C${x + side * a},${m} ${x - side * a},${m} ${x - side * a},${e} `;
    right += `C${x - side * a},${m} ${x + side * a},${m} ${x + side * a},${e} `;
    side = -side;
  }
  return left + right;
}

/**
 * The same strokes reflected about the centre line. Only for M/L/Q/C data:
 * every number pair there is a point. Arc data is not, so circles are
 * placed with `circle` on both sides instead.
 */
function mirror(d: string): string {
  return d.replace(
    /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,
    (_, x: string, y: string) => `${+(100 - Number(x)).toFixed(2)},${y}`,
  );
}

function both(d: string): string {
  return `${d} ${mirror(d)} `;
}

// ---------------------------------------------------------------- bases

const WAIST = {
  band: "M26.8,11 L73.2,11 ",
  loops: "M31,6 L31,11 M33,6 L33,11 M67,6 L67,11 M69,6 L69,11 ",
  button: circle(52, 8.5, 1),
  fly: "M50,11 L50,38 M53,11 L53,26 Q53,30 50,31 ",
};

export const SILHOUETTES: Record<Silhouette, SilhouetteShape> = {
  // A flat-laid tee: crew neck, shoulders sloping to the seam, short sleeves
  // angled down and out, straight body to the hem.
  top: {
    viewBox: "0 0 100 100",
    padded: "-20 -12 144 118",
    aspect: 1.0,
    path:
      "M37,10 L23,15 L2,30 L13,50 L23,43 L23,92 L77,92 L77,43 L87,50 " +
      "L98,30 L77,15 L63,10 Q50,19 37,10 Z",
    parts: {
      neck: "M34,11.1 Q50,21.5 66,11.1 ",
      armholes: both("M23,15 Q27,29 23,43"),
      cuffs: both("M4,28.6 L14.8,48.7"),
      hem: "M23,89 L77,89 ",
    },
  },
  // The tee's body with a narrower crew and dropped shoulders; the sleeves
  // hang to about the hem. The top edge of each sleeve is one straight
  // segment from the shoulder seam, because that edge is the sleeve
  // measurement and the hint line sits exactly on it.
  long_top: {
    viewBox: "-8 0 116 100",
    padded: "-20 -12 144 118",
    aspect: 0.9,
    path:
      "M42,10 L28,15 L-5,86 L6,89 L23,63 L23,88 L77,88 L77,63 L94,89 " +
      "L105,86 L72,15 L58,10 Q50,20 42,10 Z",
    parts: {
      neck: "M39,11.1 Q50,24 61,11.1 ",
      // Dropped armhole seams running into the body side, where the sleeve
      // lies against the body.
      armholes: both("M28,15 C28.5,30 28.5,38 23,42 L23,63"),
      cuffs: both("M-3.7,83.3 L7.6,86.5"),
      hem: "M23,85 L77,85 ",
    },
  },
  // The tee's body on narrow shoulder straps. The armhole cuts in deep
  // before it meets the side. The neck drops nearly straight and turns in
  // late, a U that meets in a point, well above the pit.
  vest: {
    viewBox: "0 0 100 100",
    padded: "-20 -12 144 118",
    aspect: 1.0,
    path:
      "M38,10 L29,15 C33,24 34,40 23,47 L23,92 L77,92 L77,47 " +
      "C66,40 67,24 71,15 L62,10 Q61,30 50,36 Q39,30 38,10 Z",
    parts: {
      neck: both("M36.1,11.1 Q37,31.8 50,38.6"),
      front: "M50,36 L50,92 ",
      hem: "M23,89 L77,89 ",
    },
  },
  // At the tops' scale: wide legs that widen a little from waist to hem and
  // nearly meet, the crotch a little over a third of the way down.
  bottom: {
    viewBox: "0 0 100 104",
    padded: "-22 -12 144 124",
    aspect: 1.04,
    path: "M27,6 L73,6 L76,99 L54,99 L50,38 L46,99 L24,99 Z",
    parts: {
      ...WAIST,
      pockets: both("M40,11 C40,16.5 35,19 26.6,19.5"),
      hems: both("M24.1,96 L46.2,96"),
    },
  },
  // The trousers' waist and rise, cut off a little over a third of the way
  // below the crotch, the legs flaring more than a trouser's.
  shorts: {
    viewBox: "0 0 100 66",
    padded: "-22 -12 144 86",
    aspect: 0.66,
    path: "M27,6 L73,6 L78,60 L53,60 L50,38 L47,60 L22,60 Z",
    parts: {
      ...WAIST,
      pockets: both("M40,11 C40,16.5 35,19 25.8,19.5"),
      hems: both("M22.3,57 L47.4,57"),
    },
  },
};

// ---------------------------------------------------------------- categories

type Recipe = (parts: Record<string, string>) => Partial<Drawing>;

const join = (...ds: (string | undefined)[]) => ds.filter(Boolean).join(" ");

const longWith =
  (neck: string, over = "", extra = ""): Recipe =>
  (p) => ({ over, details: join(neck, p.armholes, p.cuffs, p.hem, extra) });

/* Long-top neck geometry: the neck points are 42,10 and 58,10 and the
   neckline dips to 15 at the centre. Short tops: 37 and 63, dipping to 14.5. */

const LONG_V = (depth: number) =>
  "M42,10 L28,15 L-5,86 L6,89 L23,63 L23,88 L77,88 L77,63 L94,89 " +
  `L105,86 L72,15 L58,10 L50,${depth} L42,10 Z`;

/** Crew-neck ribbing: a band plus the ticks that say "knitted". */
const ribHem = (y: number) => `M23,${y} L77,${y} ${ribs(23, 77, y, 88)}`;

/** Raglan seams: from the neckband to the pit, the crewneck's shoulder. */
const RAGLAN = both("M38,11.4 Q30,30 23,42 L23,63");

/** A second cuff line above the first: a knitted or ribbed cuff. */
const DEEP_CUFFS = both("M-2.4,80.6 L9.2,84");

/**
 * A collar, drawn as it lies: the back of the collar standing up behind the
 * neck, above the shoulder line; the band's edge showing between the two
 * front leaves; the leaves folding down over the front to meet in a V.
 *
 * `back` is the part behind, `band` its lower edge seen between the leaves,
 * `leaf` the left leaf (closed, so its fold edge is drawn) — the right one
 * is its mirror. Leaves go last so they sit over the back.
 */
const collar = (back: string, band: string, leaf: string) =>
  `${back} ${band} ${both(leaf)}`;

const SHORT_POLO_COLLAR = collar(
  "M39,4 L61,4 L50,17.5 Z",
  "M43.9,10 Q50,13 56.1,10",
  "M39,4 L36,11 L45,23 L50,17.5 Z",
);

const SHIRT_COLLAR = collar(
  "M43.5,4 L56.5,4 L50,16 Z",
  "M46.75,10 Q50,12 53.25,10",
  "M43.5,4 L40.5,11 L46,22.5 L50,16 Z",
);

// Workwear: a broader collar with a wide spread.
const CHORE_COLLAR = collar(
  "M43,4 L57,4 L50,16 Z",
  "M46.5,10 Q50,12 53.5,10",
  "M43,4 L39,11 L35.5,20.5 L47,22 L50,16 Z",
);

/**
 * Tailored fronts: the fly is a plain seam down to the crotch. The J-stitch
 * curve is a jeans detail and reads as denim on anything else.
 */
const CENTRE_SEAM = "M50,11 L50,38 ";

/**
 * Sweats: a deep elastic band gathered in ribs, a drawcord out of the
 * front, and a plain centre seam, since there is no fly.
 */
const ELASTIC_WAIST =
  "M26.8,14 L73.2,14 " +
  ribs(27, 46, 7, 13, 2.5) +
  ribs(54, 73, 7, 13, 2.5) +
  "M48.5,11 L47.5,24 M51.5,11 L52.5,24 " +
  "M50,14 L50,38 ";

/** Straight slant pockets from the waistband to the side seam. */
const SLANT_POCKETS = both("M38,11 L26.3,30");

/**
 * What an open front shows of the back: the inside of the back neckline
 * across the top of the opening. Without it a scoop neck reads as a garment
 * with no back at all.
 */
const VEST_BACK_NECK = "M38,10 Q50,14.5 62,10 ";

/** Behind lapels, the back of the collar is one straight line across. */
const LAPEL_BACK = "M42,10 L58,10 ";

const RECIPES: Partial<Record<Category, Recipe>> = {
  // ---- short sleeve
  polo: (p) => ({
    over: SHORT_POLO_COLLAR,
    details: join(
      "M47.5,20 L47.5,31 L52.5,31 L52.5,20",
      circles(50, [23.5, 28]),
      p.armholes,
      p.cuffs,
      p.hem,
    ),
  }),

  // ---- long sleeve
  shirt: (p) =>
    longWith(
      join(
        "M48,19 L48,88 M52,19 L52,88",
        circles(50, [25, 37, 49, 61, 73]),
        "M58,27 L67,27 L67,36 L62.5,38 L58,36 Z",
      ),
      SHIRT_COLLAR,
    )(p),
  // Two flap chest pockets and a heavier placket than a shirt.
  overshirt: (p) =>
    longWith(
      join(
        "M48,19 L48,88 M52,19 L52,88",
        circles(50, [26, 39, 52, 65, 78], 1.1),
        both("M31,27 L39,27 L39,37 L31,37 Z M31,30.5 L39,30.5"),
      ),
      SHIRT_COLLAR,
    )(p),
  sweater: (p) => ({
    details: join(
      p.neck,
      p.armholes,
      p.cuffs,
      DEEP_CUFFS,
      ribHem(82),
      cable(36, 22, 78),
      cable(50, 22, 78),
      cable(64, 22, 78),
    ),
  }),
  // Raglan sleeves, the little V under the collar, a deep ribbed waistband.
  sweatshirt: (p) => ({
    details: join(
      p.neck,
      // Ends on the neckband curve, where it crosses x = 44.5 and 55.5.
      "M44.5,15.9 L50,23 L55.5,15.9",
      RAGLAN,
      p.cuffs,
      DEEP_CUFFS,
      ribHem(81),
    ),
  }),

  // ---- sleeveless
  tank: (p) => ({
    path:
      "M38,10 L29,15 C33,24 34,40 23,47 L23,92 L77,92 L77,47 " +
      "C66,40 67,24 71,15 L62,10 Q50,34 38,10 Z",
    over: VEST_BACK_NECK,
    details: join(
      "M36.1,11.1 Q50,38 63.9,11.1",
      both("M31,15.5 C34.5,24 35.5,41 23.2,48.8"),
      p.hem,
    ),
  }),

  // ---- outerwear
  // Drawn as a shell or windbreaker, the most common of the light jackets:
  // stand collar, full zip, a chest zip, zipped hand pockets, a drawcord hem
  // and tabbed cuffs.
  light_jacket: (p) => ({
    over: join("M42,10 L42,4.5 Q50,3.5 58,4.5 L58,10", "M50,4.3 L50,10"),
    details: join(
      "M50,10 L50,88",
      "M58,26 L67,24",
      both("M31,56 L34,72"),
      "M23,84.5 L77,84.5",
      circle(28, 86.5, 1),
      circle(72, 86.5, 1),
      p.armholes,
      p.cuffs,
      both("M1,80 L5.5,81.5"),
    ),
  }),
  // The jackets' spread collar over a storm flap, four pockets, a waist
  // cord, deep cuffs.
  heavy_jacket: (p) => ({
    over: CHORE_COLLAR,
    details: join(
      "M48,16 L48,88 M52,16 L52,88",
      both("M30,30 L40,30 L40,33 L30,33 Z"),
      both("M28,60 L41,60 L41,76 L28,76 Z M28,64 L41,64"),
      "M23,56 L77,56",
      p.armholes,
      p.cuffs,
      DEEP_CUFFS,
      p.hem,
    ),
  }),
  // A trucker: spread collar, button front, pointed-flap chest pockets
  // under a yoke, the panel seams running down to a buttoned waistband.
  denim_jacket: (p) => ({
    over: CHORE_COLLAR,
    details: join(
      "M50,16 L50,88",
      circles(50, [27, 40, 53, 66], 1.1),
      circle(50, 85, 1.1),
      "M28.4,24 L71.6,24",
      both("M30,28 L39,28 L39,31.5 L34.5,33.5 L30,31.5 Z"),
      both("M34.5,33.5 L34.5,82"),
      "M23,82 L77,82",
      p.armholes,
      p.cuffs,
    ),
  }),
  // Clean leather: the jackets' spread collar, a centre zip, a yoke seam,
  // a hem band. Nothing else.
  leather_jacket: (p) => ({
    over: CHORE_COLLAR,
    details: join(
      "M50,16 L50,88",
      "M28.4,24 L71.6,24",
      "M23,84 L77,84",
      p.armholes,
      p.cuffs,
    ),
  }),
  // Notched lapels closing low, two buttons, flap pockets, a chest welt.
  blazer: (p) => ({
    path: LONG_V(55),
    over: `${LAPEL_BACK} ${both("M42,10 L37,17 L40,19.5 L35.5,22 L50,55")}`,
    details: join(
      "M50,55 L50,88",
      circles(50, [62, 72], 1.1),
      both("M27,66 L39,66 L39,70 L27,70 Z"),
      "M61,33 L69,32",
      p.armholes,
      p.cuffs,
    ),
  }),

  // A waistcoat: the front opening and welt pockets.
  vest: (p) => ({
    over: VEST_BACK_NECK,
    details: join(
      p.neck,
      p.front,
      both("M29,64 L38,62.5"),
    ),
  }),

  // ---- bottoms
  // Drawn as dress trousers: slant pockets, a pressed crease, a blind hem.
  pants: (p) => ({
    details: join(
      p.band,
      p.loops,
      p.button,
      CENTRE_SEAM,
      SLANT_POCKETS,
      both("M38.1,18 L35,99"),
    ),
  }),
  // Five-pocket: scooped pockets finished with rivets.
  jeans: (p) => ({
    details: join(
      p.band,
      p.loops,
      p.button,
      p.fly,
      p.pockets,
      circle(27.8, 19.2, 0.6),
      circle(72.2, 19.2, 0.6),
      p.hems,
    ),
  }),
  // Elastic waist with a drawcord, seam pockets, ribbed ankles. No fly.
  sweatpants: () => ({
    details: join(
      ELASTIC_WAIST,
      both("M29,18 L28,32"),
      both("M24.2,93 L46.4,93"),
      ribs(24, 46, 93, 99, 2.5),
      ribs(54, 76, 93, 99, 2.5),
    ),
  }),
};

/** The drawing for a garment: its category's if it has one, else the base. */
export function drawingFor(
  silhouette: Silhouette,
  category?: Category | null,
): Drawing {
  const shape = SILHOUETTES[silhouette];
  const base: Drawing = {
    path: shape.path,
    under: "",
    over: "",
    details: join(...Object.values(shape.parts)),
  };
  const recipe = category ? RECIPES[category] : undefined;
  return recipe ? { ...base, ...recipe(shape.parts) } : base;
}
