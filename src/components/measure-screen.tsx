"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { GarmentSchematic } from "@/components/garment-schematic";
import { formatLength, unitSuffix } from "@/lib/units";
import { useDisplayUnit } from "@/lib/units/preference";
import { saveMeasurements } from "@/app/actions";
import {
  applyHomography,
  distanceMm,
  invertHomography,
  type Matrix3,
  type Point,
} from "@/lib/homography/solve";
import { buildMask, seedHandles, type Mask } from "@/lib/measure/mask";
import {
  type Category,
  type Convention,
  type Dimension,
  type MeasurementKey,
  type PhotoView,
  type Silhouette,
} from "@/lib/measure/templates";

/**
 * Beside the photograph, and only mildly magnified.
 *
 * A loupe under the image is useless on a phone: it sits below the finger
 * that is covering the very pixel it is meant to show. So it sits in the
 * white beside the garment instead, never over it: a preview that covers the
 * thing being measured was the complaint. At 4x it showed
 * about a centimetre of cloth, which is enough to place an edge and not
 * nearly enough to know *which* edge, hence 2x, plus the locator beside it
 * showing where on the garment that patch actually is.
 */
const LOUPE_SIZE = 180;
const LOUPE_ZOOM = 2;
/* The locator is a thumbnail of the whole garment, so it is the 3:4 of the
   photograph rather than the loupe's square. */
const LOCATOR_WIDTH = 66;
const LOCATOR_HEIGHT = 87;

export type PhotoInfo = {
  id: string;
  view: PhotoView;
  originalPath: string;
  cutoutPath: string | null;
  homography: Matrix3;
  pxPerMm: number;
};

type ExistingMeasurement = {
  key: MeasurementKey;
  photoId: string;
  valueMm: number;
  isDoubled: boolean;
  convention: Convention;
  p1X: number | null;
  p1Y: number | null;
  p2X: number | null;
  p2Y: number | null;
};

type GarmentSummary = {
  id: string;
  shortId: number;
  category: Category;
  brand: string | null;
  name: string | null;
};

/**
 * The pair and where they came from.
 *
 * The origin lives in state rather than a ref so the seeding updater stays
 * *pure*. Mutating a ref inside the updater meant React's double-invocation
 * in development poisoned its own second pass: the first marked the handles
 * as mask-seeded, the second saw that flag, concluded nothing was needed,
 * and won, so handles seeded off the bare frame before the cutout arrived
 * could never be replaced by better ones.
 *
 * It also decides what gets written. `frame` and `mask` are the machine's
 * guesses; only `user` and `stored` are somebody's measurement, and storing
 * a guess as though it were one is the exact failure this app exists to
 * avoid.
 */
type Handles = {
  p1: Point;
  p2: Point;
  source: "frame" | "mask" | "stored" | "user";
};

/** Read a design token for canvas work, which cannot use CSS variables. */
function token(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

export function MeasureScreen({
  garment,
  photo: initialPhoto,
  dimensions,
  silhouette,
  existing,
  doneHref,
}: {
  garment: GarmentSummary;
  /**
   * Where Done and Exit go. Updating from the item page returns there; a
   * garment just added goes to the closet, since that is where it now is.
   */
  doneHref: string;
  /**
   * The front, and only the front.
   *
   * Both faces are photographed and stored (the back is half of what you
   * own and a cutout of it is worth having) but measuring is a front-only
   * job. Every dimension in the Phase 0 templates reads the same off either
   * face, so offering the back as a second measuring surface only invites
   * the same garment to be measured twice and disagree with itself.
   */
  photo: PhotoInfo;
  dimensions: Dimension[];
  silhouette: Silhouette | null;
  existing: ExistingMeasurement[];
}) {
  const router = useRouter();
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const loupeRef = useRef<HTMLCanvasElement | null>(null);
  const locatorRef = useRef<HTMLCanvasElement | null>(null);

  const [photo, setPhoto] = useState(initialPhoto);
  const [unit] = useDisplayUnit();
  const [mask, setMask] = useState<Mask | null>(null);
  const [displayScale, setDisplayScale] = useState(1);
  const [selectedKey, setSelectedKey] = useState<MeasurementKey | null>(
    dimensions[0]?.key ?? null,
  );
  const [handles, setHandles] = useState<Record<string, Handles>>({});
  const [saved, setSaved] = useState<Record<string, number>>(() =>
    Object.fromEntries(existing.map((m) => [m.key, m.valueMm])),
  );
  const [dragging, setDragging] = useState<"p1" | "p2" | null>(null);
  const [loupeAt, setLoupeAt] = useState<Point | null>(null);
  const [pending, setPending] = useState(false);
  /** Complete saves what changed, then leaves; this remembers the leaving. */
  const [leaving, setLeaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [cutoutError, setCutoutError] = useState<string | null>(null);
  /** The optional dimensions stay folded away until asked for. */
  const [showOptional, setShowOptional] = useState(false);

  const activeKey =
    selectedKey && dimensions.some((d) => d.key === selectedKey)
      ? selectedKey
      : (dimensions[0]?.key ?? null);
  const activeDimension = dimensions.find((d) => d.key === activeKey) ?? null;

  const inverse = useMemo(
    () => invertHomography(photo.homography),
    [photo.homography],
  );
  const source = photo.cutoutPath ?? photo.originalPath;

  // Cutouts are jobs, so they arrive after the page does. Measuring works on
  // the photograph meanwhile; only the seeding waits for the mask.
  useEffect(() => {
    if (photo.cutoutPath) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/garments/${garment.id}/status`);
      if (!response.ok) return;
      const data = await response.json();
      if (cancelled) return;

      const mine = data.photos.find(
        (p: { id: string }) => p.id === photo.id,
      ) as { cutoutPath: string | null; error: string | null } | undefined;
      if (mine?.cutoutPath) {
        setPhoto((current) => ({ ...current, cutoutPath: mine.cutoutPath }));
      }
      setCutoutError(mine?.error ?? null);
      if (data.settled) clearInterval(timer);
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [photo.cutoutPath, photo.id, garment.id]);

  const readImage = useCallback(
    (image: HTMLImageElement) => {
      if (!image.naturalWidth) return;
      setDisplayScale(image.clientWidth / image.naturalWidth);
      if (photo.cutoutPath) {
        setMask((current) => current ?? buildMask(image));
      }
    },
    [photo.cutoutPath],
  );

  /**
   * Attach and, if the browser already had the image, read it immediately.
   *
   * `onLoad` never fires for an image that finished decoding before React
   * attached the handler, which is precisely what happens on a reload, when
   * the cutout is already in cache. The mask then never gets built and the
   * handles are seeded off the bare frame for the rest of the session.
   */
  const attachImage = useCallback(
    (element: HTMLImageElement | null) => {
      imageRef.current = element;
      if (element?.complete) readImage(element);
    },
    [readImage],
  );

  useEffect(() => {
    function onResize() {
      const image = imageRef.current;
      if (image?.naturalWidth) {
        setDisplayScale(image.clientWidth / image.naturalWidth);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Seed handles once the geometry is known: from what was stored last time,
  // from the mask where there is one, from the frame otherwise.
  useEffect(() => {
    const image = imageRef.current;
    if (!image?.naturalWidth) return;

    setHandles((current) => {
      const next = { ...current };
      let changed = false;

      for (const dimension of dimensions) {
        const held = next[dimension.key];
        // Seed when there is nothing, or when the pair was placed off the
        // bare frame and the mask has since arrived. Never once the user has
        // moved them.
        const needsSeed = !held || (held.source === "frame" && mask !== null);
        if (!needsSeed) continue;

        const stored = existing.find((m) => m.key === dimension.key);
        if (
          stored?.p1X != null &&
          stored.p1Y != null &&
          stored.p2X != null &&
          stored.p2Y != null
        ) {
          // Stored coordinates are in this photo's metric canvas.
          next[dimension.key] = {
            p1: applyHomography(inverse, { x: stored.p1X, y: stored.p1Y }),
            p2: applyHomography(inverse, { x: stored.p2X, y: stored.p2Y }),
            source: "stored",
          };
          changed = true;
          continue;
        }

        const [p1, p2] = seedHandles(mask, dimension.seed, {
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
        next[dimension.key] = { p1, p2, source: mask ? "mask" : "frame" };
        changed = true;
      }

      // Returning the same object when nothing moved keeps this effect from
      // re-triggering itself.
      return changed ? next : current;
    });
  }, [dimensions, existing, inverse, mask, displayScale]);

  const currentHandles = activeKey ? handles[activeKey] : undefined;

  const measure = useCallback(
    (h: Handles) => distanceMm(photo.homography, h.p1, h.p2, photo.pxPerMm),
    [photo.homography, photo.pxPerMm],
  );

  /** What the pins read right now: the live number under the photograph. */
  const liveMm = currentHandles && measure(currentHandles);

  /**
   * Every dimension somebody has actually settled, at what it currently
   * reads. Moving a pin changes this immediately; nothing reaches the
   * database until the button at the bottom is pressed.
   *
   * A stored row keeps its stored number until a pin is dragged, rather than
   * being re-derived from its coordinates. Those coordinates are integers in
   * a 4 px/mm canvas, so re-deriving can land a millimetre off the number
   * that was actually stored, enough to light up "Update" on a page nobody
   * has touched.
   */
  const placed = useMemo(() => {
    const out: Record<string, number> = { ...saved };
    for (const dimension of dimensions) {
      const held = handles[dimension.key];
      if (held?.source === "user") out[dimension.key] = measure(held);
    }
    return out;
  }, [dimensions, handles, measure, saved]);

  const changedKeys = dimensions
    .filter((d) => placed[d.key] != null && placed[d.key] !== saved[d.key])
    .map((d) => d.key);

  function toImageSpace(event: React.PointerEvent | PointerEvent): Point {
    const rect = frameRef.current!.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / displayScale,
      y: (event.clientY - rect.top) / displayScale,
    };
  }

  /**
   * Free placement, always.
   *
   * Snapping to the nearest mask edge fights the user whenever the semantic
   * point is a seam a few millimetres inside the outline, and on a phone
   * there is no modifier key to suspend it with. The mask still earns its
   * keep seeding the pairs; it does not get a vote after that.
   */
  function moveHandle(which: "p1" | "p2", point: Point) {
    if (!activeKey) return;
    setHandles((current) => ({
      ...current,
      [activeKey]: { ...current[activeKey], [which]: point, source: "user" },
    }));
    setLoupeAt(point);
    setNote(null);
  }

  // The listeners live for one drag. They read the latest handlers through
  // a ref, so the effect does not have to re-register on every render.
  const onDragMove = useRef<(event: PointerEvent) => void>(() => {});
  useEffect(() => {
    onDragMove.current = (event) => {
      if (dragging) moveHandle(dragging, toImageSpace(event));
    };
  });

  useEffect(() => {
    if (!dragging) return;
    function onMove(event: PointerEvent) {
      event.preventDefault();
      onDragMove.current(event);
    }
    function onUp() {
      setDragging(null);
      setLoupeAt(null);
    }
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging]);

  // The loupe and the locator: the finger covers exactly the pixel being
  // placed, and a magnified patch of cloth on its own says nothing about
  // where on the garment you are.
  useEffect(() => {
    const image = imageRef.current;
    if (!image || !loupeAt) return;
    const fg = token("--fg", "#000");

    const loupe = loupeRef.current;
    if (loupe) {
      const ctx = loupe.getContext("2d")!;
      const span = LOUPE_SIZE / LOUPE_ZOOM;
      ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        image,
        loupeAt.x - span / 2,
        loupeAt.y - span / 2,
        span,
        span,
        0,
        0,
        LOUPE_SIZE,
        LOUPE_SIZE,
      );
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.moveTo(LOUPE_SIZE / 2, 0);
      ctx.lineTo(LOUPE_SIZE / 2, LOUPE_SIZE);
      ctx.moveTo(0, LOUPE_SIZE / 2);
      ctx.lineTo(LOUPE_SIZE, LOUPE_SIZE / 2);
      ctx.stroke();
    }

    const locator = locatorRef.current;
    if (locator) {
      const ctx = locator.getContext("2d")!;
      ctx.clearRect(0, 0, LOCATOR_WIDTH, LOCATOR_HEIGHT);
      const scale = Math.min(
        LOCATOR_WIDTH / image.naturalWidth,
        LOCATOR_HEIGHT / image.naturalHeight,
      );
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      const ox = (LOCATOR_WIDTH - w) / 2;
      const oy = (LOCATOR_HEIGHT - h) / 2;
      ctx.globalAlpha = 0.45;
      ctx.drawImage(image, ox, oy, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = fg;
      ctx.strokeRect(
        Math.round(ox + loupeAt.x * scale) - 5.5,
        Math.round(oy + loupeAt.y * scale) - 5.5,
        11,
        11,
      );
    }
  }, [loupeAt]);

  /**
   * Pressing Next accepts the pins where they are. That is a decision, not
   * a machine guess: the person has looked at the line on the cloth and
   * moved on, so the pair counts as theirs from here.
   */
  function confirm(key: MeasurementKey) {
    setHandles((current) =>
      current[key]
        ? { ...current, [key]: { ...current[key], source: "user" } }
        : current,
    );
  }

  /** Store the given keys at what their pins read, then back to the item. */
  async function onComplete(keys: MeasurementKey[]) {
    if (keys.length === 0) {
      router.push(doneHref);
      return;
    }
    setPending(true);
    setNote(null);
    try {
      await saveMeasurements({
        garmentId: garment.id,
        photoId: photo.id,
        rows: keys.map((key) => {
          const dimension = dimensions.find((d) => d.key === key)!;
          const held = handles[key];
          return {
            key,
            valueMm: measure(held),
            // Stored, never asked. The guide sentence and the sketch define
            // what was done; these record it so a brand chart can be
            // compared against it later without guessing.
            isDoubled: dimension.defaultIsDoubled,
            convention: dimension.defaultConvention,
            // In this photo's metric canvas, so the overlay survives a re-cut.
            p1: applyHomography(photo.homography, held.p1),
            p2: applyHomography(photo.homography, held.p2),
          };
        }),
      });
      setSaved((current) => ({
        ...current,
        ...Object.fromEntries(keys.map((k) => [k, measure(handles[k])])),
      }));
      setLeaving(true);
      router.push(doneHref);
    } catch {
      setNote("Could not store. Check the server log.");
      setPending(false);
    }
  }

  /**
   * One dimension at a time, in order. Next accepts this one and moves to
   * the next; on the last it stores everything accepted and leaves. Every
   * dimension whose pins were touched or accepted is written, so a pair the
   * person skipped past by jumping in the list is not.
   */
  const shown = dimensions.filter(
    (d) => !d.optional || showOptional || saved[d.key] != null,
  );
  const hiddenCount = dimensions.filter(
    (d) => d.optional && saved[d.key] == null,
  ).length;

  function nextLabel(): string {
    if (pending) return "Saving…";
    return isLast ? "Done" : "Next";
  }

  function onNext() {
    if (!activeKey) return;
    const index = shown.findIndex((d) => d.key === activeKey);
    const following = shown[index + 1];
    confirm(activeKey);
    if (following) {
      setSelectedKey(following.key);
      return;
    }
    const accepted = new Set<MeasurementKey>(changedKeys);
    for (const d of dimensions) {
      if (handles[d.key]?.source === "user") accepted.add(d.key);
    }
    accepted.add(activeKey);
    void onComplete([...accepted]);
  }

  /* Back is the previous dimension, not the way out. What was placed on
     this one is kept, exactly as Next keeps it. */
  function onPrevious() {
    if (!activeKey) return;
    const index = shown.findIndex((d) => d.key === activeKey);
    const previous = shown[index - 1];
    if (!previous) return;
    confirm(activeKey);
    setSelectedKey(previous.key);
  }

  const stepIndex = shown.findIndex((d) => d.key === activeKey);
  const stepLabel = `${stepIndex + 1} / ${shown.length}`;
  const isLast = stepIndex === shown.length - 1;
  const isFirst = stepIndex <= 0;

  /* The way out, top right, where a close always is. */
  const exit = (
    <Link href={doneHref} className="label link-text shrink-0">
      {changedKeys.length > 0 ? "Discard" : "Exit"}
    </Link>
  );

  /* The reading: which dimension, what the pins say, and the loupe while a
     pin is held. On a phone a small sketch sits beside it so the guide line
     is visible without scrolling away from the photo; on desktop the sketch
     is larger and lives under the reading in the side column. */
  const reading = (
    <div className="flex items-start gap-5">
      {silhouette ? (
        <GarmentSchematic
          silhouette={silhouette}
          category={garment.category}
          dimensions={shown}
          values={{}}
          activeKey={activeKey}
          onSelect={setSelectedKey}
          className="block h-auto w-44 shrink-0 md:hidden"
        />
      ) : null}
      <div className="min-w-0">
        <p className="label text-fg2">
          <span className="data text-fg3">{stepLabel}</span>{" "}
          {activeDimension?.label}
        </p>
        <p className="mt-1">
          <span className="font-mono text-24 tracking-[-0.03em]">
            {liveMm ?? "—"}
          </span>
          <span className="text-fg2 ml-1.5 text-12">mm</span>
        </p>
        <p className="text-fg3 mt-1 text-11">
          Drag either pin. It magnifies beside the photo while you hold it.
        </p>
      </div>
      <div className="ml-auto">{exit}</div>
    </div>
  );

  /* Next is the filled button, as Save is on the item page; Back steps to
     the previous dimension and is the text beside it. */
  const nextRow = (
    <div className="flex items-center justify-center gap-4 md:justify-start">
      <button
        type="button"
        className="btn-secondary px-10 py-3"
        onClick={onPrevious}
        disabled={pending || leaving || isFirst}
      >
        Back
      </button>
      <button
        type="button"
        className="btn-primary px-10 py-3"
        onClick={onNext}
        disabled={pending || leaving || !activeKey}
      >
        {nextLabel()}
      </button>
    </div>
  );

  const list =
    activeDimension && silhouette ? (
      <>
        <GarmentSchematic
          silhouette={silhouette}
          category={garment.category}
          dimensions={shown}
          values={{}}
          activeKey={activeKey}
          onSelect={setSelectedKey}
          className="hidden h-auto w-full max-w-[340px] md:block"
        />

        {/* Two columns on a phone so the whole list fits under the photo
            without scrolling; one column in the desktop side panel. */}
        <ul className="rule-top grid grid-cols-2 gap-x-6 md:mt-5 md:grid-cols-1">
          {shown.map((dimension) => {
            const selected = activeKey === dimension.key;
            const value = placed[dimension.key];
            return (
              <li key={dimension.key} className="border-rule border-b">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedKey(dimension.key)}
                  className="link-text flex w-full items-baseline justify-between gap-3 py-1 text-left text-12 md:py-2"
                >
                  <span className="flex items-baseline gap-2">
                    <span aria-hidden className={selected ? "" : "invisible"}>
                      &mdash;
                    </span>
                    <span className={selected ? "text-fg underline" : ""}>
                      {dimension.label}
                    </span>
                  </span>
                  <span className={`data ${value != null ? "" : "text-fg3"}`}>
                    {value != null
                      ? `${formatLength(value, unit)} ${unitSuffix(unit)}`
                      : "—"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {hiddenCount > 0 ? (
          <button
            type="button"
            className="label link-text mt-3"
            onClick={() => setShowOptional((v) => !v)}
          >
            {showOptional ? "Fewer" : `+${hiddenCount} more`}
          </button>
        ) : null}

        {/* Three lines are reserved whatever the guide's length, so Back
            and Next stay put from one dimension to the next. */}
        <p className="text-fg2 mt-3 min-h-[calc(3*1.35em)] text-12 md:mt-4">
          {activeDimension.guide}
        </p>
      </>
    ) : (
      <p className="text-fg2 text-12">
        No template for this category yet. Tops and bottoms are in Phase 0;
        shoes and hats get their own flows in Phase 2.
      </p>
    );

  function cutoutStatus() {
    if (cutoutError) {
      return (
        <p className="data text-fg2 text-center md:text-left">
          Cutout failed: {cutoutError}
        </p>
      );
    }
    if (!photo.cutoutPath) {
      return (
        <p className="data text-fg3 text-center md:text-left">Cutting out…</p>
      );
    }
    return null;
  }

  const status = cutoutStatus();

  return (
    /* Phone: reading, photo, Next, then the list. Desktop: a frame exactly
       the viewport height, the photo as tall as it allows on the left, the
       panel on the right; the page does not scroll. */
    <div className="grid gap-4 md:mx-auto md:mb-[calc(var(--screen-gap)-var(--main-pb))] md:h-[calc(100dvh-var(--header-h)-var(--screen-gap))] md:max-w-[1400px] md:grid-cols-[minmax(0,1fr)_300px] md:gap-x-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-10">
      <div className="md:hidden">{reading}</div>

      <div className="relative flex items-start justify-center md:col-start-1 md:row-span-2 md:row-start-1 md:h-full md:min-h-0">
        {/* Pointer events pass through the loupe so a drag is not
            interrupted by the thing the drag is drawing. */}
        <div
          className={`pointer-events-none absolute top-0 right-0 z-10 flex flex-row-reverse items-start gap-2 ${loupeAt ? "" : "hidden"}`}
        >
          <canvas
            ref={loupeRef}
            width={LOUPE_SIZE}
            height={LOUPE_SIZE}
            className="border-fg bg-bg border"
          />
          <canvas
            ref={locatorRef}
            width={LOCATOR_WIDTH}
            height={LOCATOR_HEIGHT}
            className="border-fg bg-bg border"
          />
        </div>
        {/* The frame hugs the image exactly, since the overlay positions
            pins against it. */}
        <div ref={frameRef} className="relative w-fit select-none">
          {/* Plain <img> on purpose: the mask is read off these exact
              pixels, so nothing may resample them. See eslint.config.mjs. */}
          <img
            key={photo.id}
            ref={attachImage}
            src={`/api/media/${source}`}
            alt=""
            onLoad={(event) => readImage(event.currentTarget)}
            className="block h-auto max-h-(--measure-photo-h) w-auto max-w-full md:max-h-[calc(100dvh-var(--header-h)-var(--screen-gap))]"
            draggable={false}
          />

          {currentHandles ? (
            <Overlay
              handles={currentHandles}
              scale={displayScale}
              onGrab={(which, event) => {
                event.preventDefault();
                setDragging(which);
                setLoupeAt(currentHandles[which]);
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="md:hidden">
        {nextRow}
        {status ? <div className="mt-3">{status}</div> : null}
      </div>

      {/* Desktop: one panel, reading on top, stuck under the header while the
          tall photo scrolls beside it. */}
      <div className="md:col-start-2 md:row-span-2 md:row-start-1 md:min-h-0 md:overflow-y-auto">
        <div className="hidden pb-5 md:block">{reading}</div>
        {list}
        {/* Buttons follow the list rather than being pinned to the foot of
            the column, so they sit under the guide where the eye ends. */}
        <div className="hidden pt-6 md:block">
          {nextRow}
          {status ? <div className="mt-3">{status}</div> : null}
        </div>
        {note ? <p className="data text-fg2 mt-3">{note}</p> : null}
      </div>
    </div>
  );
}

function Overlay({
  handles,
  scale,
  onGrab,
}: {
  handles: Handles;
  scale: number;
  onGrab: (which: "p1" | "p2", event: React.PointerEvent) => void;
}) {
  const a = { x: handles.p1.x * scale, y: handles.p1.y * scale };
  const b = { x: handles.p2.x * scale, y: handles.p2.y * scale };

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="var(--fg)"
          strokeWidth={1}
        />
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="var(--bg)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      </svg>
      {(["p1", "p2"] as const).map((which) => {
        const p = which === "p1" ? a : b;
        return (
          <button
            key={which}
            type="button"
            aria-label={which === "p1" ? "First handle" : "Second handle"}
            onPointerDown={(event) => onGrab(which, event)}
            className="border-fg bg-bg absolute h-6 w-6 cursor-grab touch-none border active:cursor-grabbing"
            style={{ left: p.x - 12, top: p.y - 12 }}
          >
            <span className="bg-fg absolute left-1/2 top-1/2 block h-1 w-1 -translate-x-1/2 -translate-y-1/2" />
          </button>
        );
      })}
    </>
  );
}
