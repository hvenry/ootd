import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Schema: garment, measurement, photo, job. Planned tables: docs/DATA-MODEL.md.
 *
 * Two rules from CLAUDE.md are enforced structurally here rather than by
 * convention, because violating either produces wrong numbers that nobody
 * notices:
 *   - every length is `integer` millimetres, never numeric, never inches;
 *   - every table carries `owner_id`, single-user today, multi-tenant later.
 */

// ---------------------------------------------------------------- enums

/**
 * What the garment is. This drives which measurement template loads, and
 * nothing else — every top in this list is measured identically, so the
 * distinctions here exist to make the closet searchable and the layer
 * validator correct, not to fork the measuring.
 *
 * The finer names people actually use — oxford, flannel, camp collar,
 * bowling — live in `subcategory`, which is free text. A denim shirt and a
 * dress shirt are both `shirt`: they differ in fabric and formality, both of
 * which have their own columns, and in nothing this enum is for.
 */
export const categoryEnum = pgEnum("category", [
  "tshirt",
  "polo",
  "henley",
  "short_sleeve_henley",
  "long_sleeve",
  "shirt",
  "short_sleeve_shirt",
  "overshirt",
  "turtleneck",
  "sweater",
  "crewneck",
  "hoodie",
  "fleece",
  "cardigan",
  "tank",
  "shell",
  "chore_jacket",
  "denim_jacket",
  "leather_jacket",
  "blazer",
  "coat",
  "parka",
  "puffer_vest",
  "vest",
  "trousers",
  "jeans",
  "sweatpants",
  "shorts",
  "sweat_shorts",
  "shoe",
  "hat",
]);

export const stretchEnum = pgEnum("stretch", ["none", "low", "high"]);

export const layerSlotEnum = pgEnum("layer_slot", [
  "base",
  "mid",
  "outer",
  "shell",
  "bottom",
  "footwear",
  "headwear",
]);

export const measurementKeyEnum = pgEnum("measurement_key", [
  "chest",
  "shoulder",
  "sleeve",
  "body_length",
  "waist",
  "front_rise",
  "back_rise",
  "thigh",
  "knee",
  "inseam",
  "outseam",
  "leg_opening",
  "hem",
  "bicep",
  "cuff",
  "collar",
]);

/**
 * How the two handles were placed. Brands disagree and the disagreement is
 * invisible in the number alone: Standard & Strange double pit-to-pit and
 * measure edge to edge; 3sixteen do neither and measure 1" below the pit.
 * Storing this per row is what makes a brand-chart comparison meaningful.
 */
export const conventionEnum = pgEnum("convention", [
  "edge_to_edge",
  "seam_to_seam",
  "one_inch_below_pit",
  "hps_to_hem",
  "back_waistband",
]);

export const measurementSourceEnum = pgEnum("measurement_source", [
  "measured",
  "brand_spec",
  "estimated",
]);

/**
 * Which face of the garment a photo shows.
 *
 * A garment is photographed more than once because some dimensions only
 * exist on one side: back rise is a back measurement, and taking it off a
 * front photo is wrong in a way nothing would flag.
 */
export const photoViewEnum = pgEnum("photo_view", ["front", "back", "detail"]);

/**
 * What a detail photo is a close-up of. Only detail photos carry one.
 *
 * A detail is shot off the rig, close enough to read: the care label's fibre
 * content, the weave, a print or embroidery, a button or zip. It is context
 * for the render and, later, for the clo estimate — never a measuring surface.
 */
export const detailKindEnum = pgEnum("detail_kind", [
  "label",
  "fabric",
  "print",
  "hardware",
  "other",
]);

export const jobKindEnum = pgEnum("job_kind", [
  "cutout",
  "colour_extract",
  "render",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "running",
  "done",
  "failed",
]);

// ---------------------------------------------------------------- photo

export const photo = pgTable(
  "photo",
  {
    id: uuid().primaryKey(),
    ownerId: uuid().notNull(),
    /**
     * Set once the garment exists; a garment has many photos.
     *
     * The reference is deliberate: without it, deleting a garment leaves its
     * photos and their files behind as orphans that nothing will ever collect.
     * It is nullable because the photo row is written first — the garment needs
     * a photo id, and the photo needs a garment id, so one of them has to go
     * second.
     */
    garmentId: uuid().references((): AnyPgColumn => garment.id, {
      onDelete: "cascade",
    }),
    view: photoViewEnum().notNull().default("front"),
    detailKind: detailKindEnum(),
    /** Kept forever, so the whole closet can be re-cut with a better model later. */
    originalPath: text().notNull(),
    /**
     * { m: number[9] (row-major 3x3, image px -> canvas px), pxPerMm: number }
     *
     * Null only on a detail photo. A close-up is shot too near for the
     * markers to be in frame, and a detail with a fabricated scale would be
     * a measuring surface that measures nothing correctly.
     */
    homography: jsonb(),
    /** Background-removed PNG for *this* view. */
    cutoutPath: text(),
    /**
     * Which CUTOUT_PROVIDER produced `cutout_path`. Null for cutouts made
     * before this was recorded, which came from the configured default.
     */
    cutoutProvider: text(),
    /**
     * The garment's box inside the cutout, in the original's pixels:
     * { x, y, w, h, imageW, imageH }. Written with the cutout, so the measure
     * screen can open already cropped to the garment instead of showing the
     * whole frame until the PNG has downloaded and been read.
     */
    cutoutBounds: jsonb(),
    /** From configuration, or the reserved ArUco IDs on a rig that prints them. */
    sheetVersion: integer().notNull().default(0),
    /** sRGB triple off the neutral patch, for white balance. Null if out of frame. */
    greyPatchRgb: integer().array(),
    takenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One front and one back per garment: reshooting either replaces it.
    // Details are as many as the garment has worth reading.
    uniqueIndex("photo_garment_view")
      .on(t.garmentId, t.view)
      .where(sql`${t.view} <> 'detail'`),
    check(
      "photo_measurable_view",
      sql`${t.view} = 'detail' OR ${t.homography} IS NOT NULL`,
    ),
    check(
      "photo_detail_kind",
      sql`(${t.view} = 'detail') = (${t.detailKind} IS NOT NULL)`,
    ),
    index("photo_owner_garment").on(t.ownerId, t.garmentId),
  ],
);

// ---------------------------------------------------------------- garment

export const garment = pgTable(
  "garment",
  {
    id: uuid().primaryKey(),
    ownerId: uuid().notNull(),
    category: categoryEnum().notNull(),
    subcategory: text(),
    brand: text(),
    name: text(),
    /**
     * The colour named at capture ("Navy"), from the fixed list in
     * lib/colour/declared. Separate from garment_colour, which the extractor
     * fills from pixels: this is what the owner calls it, and it is what the
     * closet filters on until the clusters exist.
     */
    declaredColour: text(),
    /** Per-owner sequence, shown as 014. The spoken handle for an item. */
    shortId: integer().notNull(),
    /** The front photo — what the closet grid shows. */
    photoId: uuid(),
    /** The front photo's cutout, denormalised so the grid is one query. */
    cutoutPath: text(),
    fabric: text(),
    stretch: stretchEnum().notNull().default("none"),
    clo: numeric({ precision: 3, scale: 2 }),
    windproof: boolean().notNull().default(false),
    waterproof: boolean().notNull().default(false),
    layerSlot: layerSlotEnum().notNull(),
    layerIndex: integer().notNull().default(0),
    /**
     * When the measurements were first submitted — the moment this stopped
     * being a capture in progress and became something you own.
     *
     * A garment row has to exist from the first photograph: the cutout is a
     * job, the job needs a file on disk and a row to write back to, and the
     * measure screen reads both. But a capture abandoned halfway is not a
     * garment, and it has no business in the closet. Null means unfinished,
     * and the closet lists those separately so they can be resumed or thrown
     * away rather than sitting in the grid with no measurement under them.
     */
    completedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("garment_owner_short_id").on(t.ownerId, t.shortId),
    index("garment_owner_created").on(t.ownerId, t.createdAt),
  ],
);

// ---------------------------------------------------------------- measurement

export const measurement = pgTable(
  "measurement",
  {
    id: uuid().primaryKey(),
    ownerId: uuid().notNull(),
    garmentId: uuid()
      .notNull()
      .references(() => garment.id, { onDelete: "cascade" }),
    /**
     * Which photo the handles were placed on. Without it the stored canvas
     * coordinates are ambiguous the moment a garment has more than one view,
     * and the overlay would redraw a back measurement onto the front.
     */
    photoId: uuid()
      .notNull()
      .references(() => photo.id, { onDelete: "cascade" }),
    key: measurementKeyEnum().notNull(),
    /** Always millimetres, always integer. Display units resolve at render time. */
    valueMm: integer().notNull(),
    /** Whether the value already represents the full circumference. */
    isDoubled: boolean().notNull(),
    convention: conventionEnum().notNull(),
    source: measurementSourceEnum().notNull().default("measured"),
    /** Handle positions in the metric canvas, for the overlay and re-derivation. */
    p1X: integer(),
    p1Y: integer(),
    p2X: integer(),
    p2Y: integer(),
    measuredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("measurement_garment_key").on(t.garmentId, t.key),
    index("measurement_owner_garment").on(t.ownerId, t.garmentId),
  ],
);

// ---------------------------------------------------------------- job

export const job = pgTable(
  "job",
  {
    id: uuid().primaryKey(),
    ownerId: uuid().notNull(),
    kind: jobKindEnum().notNull(),
    payload: jsonb().notNull(),
    status: jobStatusEnum().notNull().default("pending"),
    result: jsonb(),
    /** Dedupe key; a done job with the same hash is reused rather than rerun. */
    contentHash: text().notNull(),
    attempts: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("job_kind_content_hash").on(t.kind, t.contentHash),
    // The worker's claim query: WHERE status = 'pending' ORDER BY created_at
    // FOR UPDATE SKIP LOCKED.
    index("job_status_created").on(t.status, t.createdAt),
  ],
);

export type PhotoView = (typeof photoViewEnum.enumValues)[number];
export type DetailKind = (typeof detailKindEnum.enumValues)[number];
export type Garment = typeof garment.$inferSelect;
export type Measurement = typeof measurement.$inferSelect;
export type Photo = typeof photo.$inferSelect;
export type Job = typeof job.$inferSelect;
