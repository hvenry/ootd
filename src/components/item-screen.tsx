"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { GarmentDetails } from "@/components/garment-details";
import { GarmentSchematic } from "@/components/garment-schematic";
import { PhotoStrip } from "@/components/photo-strip";
import { useActivity } from "@/components/activity";
import { deleteDetailPhoto } from "@/app/actions";
import type { KnownBrand } from "@/lib/search/brands";
import { useDisplayUnit } from "@/lib/units/preference";
import { declaredHex } from "@/lib/colour/declared";
import {
  CATEGORY_LABELS,
  DETAIL_KIND_LABELS,
  type Category,
  type DetailKind,
  type Dimension,
  type MeasurementKey,
  type PhotoView,
  type Silhouette,
} from "@/lib/measure/templates";

type ItemPhoto = {
  id: string;
  view: PhotoView;
  detailKind: DetailKind | null;
  src: string;
  fallback: string;
};

/**
 * The pager's word for each photo. Two details of one kind are numbered,
 * since "Fabric Fabric" under the strip says nothing about which is which.
 */
function photoLabels(photos: ItemPhoto[]): string[] {
  const seen = new Map<string, number>();
  return photos.map((p) => {
    if (p.view === "front") return "Front";
    if (p.view === "back") return "Back";
    const base = DETAIL_KIND_LABELS[p.detailKind ?? "other"];
    const total = photos.filter((q) => q.detailKind === p.detailKind).length;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return total > 1 ? `${base} ${n}` : base;
  });
}

/**
 * View mode.
 *
 * The item is the photographs. Everything else (numbers, the diagram, the
 * details form) stays folded until asked for, because a closet is looked at
 * far more often than it is measured, and a number under every garment is
 * noise on the day you only wanted to see the shirt.
 */
export function ItemScreen({
  garment,
  photos,
  dimensions,
  silhouette,
  values,
  brands,
}: {
  brands: KnownBrand[];
  garment: {
    id: string;
    shortId: number;
    category: Category;
    brand: string | null;
    name: string | null;
    declaredColour: string | null;
  };
  photos: ItemPhoto[];
  dimensions: Dimension[];
  silhouette: Silhouette | null;
  values: Record<string, number | undefined>;
}) {
  const router = useRouter();
  const { toast } = useActivity();
  const [index, setIndex] = useState(0);
  const labels = photoLabels(photos);
  const shown = photos[Math.min(index, photos.length - 1)];
  const [removing, setRemoving] = useState(false);

  async function onRemoveDetail(id: string) {
    setRemoving(true);
    try {
      await deleteDetailPhoto(id);
      toast({ message: "Detail removed" });
      setIndex((i) => Math.max(0, i - 1));
      router.refresh();
    } finally {
      setRemoving(false);
    }
  }

  const measured = dimensions.filter((d) => values[d.key] != null);
  const measuredKeys = measured.map((d) => d.key) as MeasurementKey[];
  const shownDimensions = dimensions.filter(
    (d) => !d.optional || values[d.key] != null,
  );
  const missing = shownDimensions.filter((d) => values[d.key] == null).length;

  const [details, setDetails] = useState(false);
  const [unit, cycleUnit] = useDisplayUnit();
  const [selected, setSelected] = useState<MeasurementKey | null>(null);
  const [hovered, setHovered] = useState<MeasurementKey | null>(null);
  // Hover previews the name; a click locks it so it survives the pointer
  // leaving. Hover wins while it lasts.
  const shownKey = hovered ?? selected;
  const shownLabel = dimensions.find((d) => d.key === shownKey)?.label;

  const id = String(garment.shortId).padStart(3, "0");

  /* Brand, name, then category · colour · id. Brand, category and colour
     are links back to the closet with that filter applied: the item page is
     also the way to ask "what else do I have like this?". */
  const filterHref = (key: string, value: string) =>
    `/?${new URLSearchParams({ [key]: value })}`;
  const colourHex = declaredHex(garment.declaredColour);
  const meta = (
    <div>
      <p className="label">
        {garment.brand ? (
          <Link href={filterHref("brand", garment.brand)} className="link-text">
            {garment.brand}
          </Link>
        ) : (
          "Unbranded"
        )}
      </p>
      <p>{garment.name ?? "Untitled"}</p>
      <p className="data text-fg3 mt-1 flex flex-wrap items-center gap-x-1.5">
        <Link
          href={filterHref("category", garment.category)}
          className="link-text"
        >
          {CATEGORY_LABELS[garment.category]}
        </Link>
        {garment.declaredColour ? (
          <>
            <span aria-hidden>·</span>
            <Link
              href={filterHref("colour", garment.declaredColour)}
              className="link-text inline-flex items-center gap-1.5"
            >
              {colourHex ? (
                <span
                  aria-hidden
                  className="swatch"
                  style={{ background: colourHex }}
                />
              ) : null}
              {garment.declaredColour}
            </Link>
          </>
        ) : null}
        <span aria-hidden>·</span>
        <span>{id}</span>
      </p>
    </div>
  );

  /* The numbers live on the diagram, not in a list: a figure beside the
     line it measures is checkable at a glance, and a list is not. */
  const info = (
    <div>
      <div className="flex items-center gap-3">
        <p className="label">Measurements</p>
        {/* One control, one word, cycling mm → cm → in. Site-wide. */}
        <button
          type="button"
          onClick={cycleUnit}
          className="chip px-2.5 py-1.5"
          aria-label={`Units: ${unit}. Click to change.`}
        >
          {unit}
        </button>
      </div>
      {/* The hovered or locked dimension's name. The line holds its height
          when empty so the diagram does not jump. */}
      <p className="text-fg2 mt-1 min-h-[1.35em]">{shownLabel ?? ""}</p>
      {measured.length === 0 ? (
        <p className="text-fg3 mt-1">Not measured yet.</p>
      ) : silhouette ? (
        <GarmentSchematic
          silhouette={silhouette}
          category={garment.category}
          dimensions={shownDimensions}
          values={values}
          unit={unit}
          activeKey={selected}
          onHover={setHovered}
          onSelect={(key) => setSelected((k) => (k === key ? null : key))}
          className="mx-auto mt-2 block h-auto w-full max-w-[340px] sm:mx-0"
        />
      ) : null}
      {missing > 0 && measured.length > 0 ? (
        <p className="text-fg3 mt-3">{missing} not yet placed.</p>
      ) : null}
    </div>
  );

  /* Measure takes the filled slot: it is the thing to do with an item, as
     add-to-bag is on a shop. Edit sits beside it as text. */
  const actions = (
    <div>
      <div className="action-row">
        <Link
          href={`/measure/${garment.id}`}
          className="btn-primary flex-1 py-4"
        >
          {measured.length > 0 ? "Update measurements" : "Measure"}
        </Link>
        <button
          type="button"
          onClick={() => setDetails(true)}
          className="label link-text"
        >
          Edit details
        </button>
      </div>
      {measured.length === 0 ? (
        <p className="text-fg3 mt-4 text-center sm:text-left">
          {shownDimensions.length} to place.
        </p>
      ) : null}
    </div>
  );

  /* Edit mode takes the diagram's slot and the action row with it: the
     form where the numbers were, Save and Discard where Measure was. */
  const editor = (
    <GarmentDetails
      garmentId={garment.id}
      category={garment.category}
      brand={garment.brand}
      name={garment.name}
      declaredColour={garment.declaredColour}
      shortId={garment.shortId}
      measuredKeys={measuredKeys}
      brands={brands}
      onClose={() => setDetails(false)}
    />
  );

  return (
    /* Phone: image, then meta, actions, info stacked. From 640px: image
       left, the three blocks in a right column, halves first and then a
       3:2 split once there is room. Desktop: three columns with the
       image in the middle and the text blocks parked at the same height
       either side of it, as a product page does. */
    <div className="grid gap-10 sm:grid-cols-2 sm:gap-x-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-x-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] lg:gap-x-12">
      {/* On desktop the column is exactly the viewport minus the header
          offset above and main's bottom padding below, and the strip takes
          what the pager leaves, so the page does not scroll. */}
      <div className="flex flex-col lg:col-start-2 lg:row-start-1 lg:h-[calc(100dvh-var(--header-h)-var(--main-pb))]">
        <PhotoStrip
          photos={photos.map((p, i) => ({
            id: p.id,
            src: p.src,
            fallback: p.fallback,
            alt: labels[i],
          }))}
          index={index}
          onIndexChange={setIndex}
          className="lg:min-h-0 lg:flex-1"
          imgClassName="aspect-[3/4] lg:aspect-auto lg:h-full"
        />

        {photos.length > 1 ? (
          <div className="mt-4 flex shrink-0 flex-wrap justify-center gap-x-6 gap-y-2">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-pressed={index === i}
                className="label tab"
              >
                {labels[i]}
              </button>
            ))}
          </div>
        ) : null}

        {/* A close-up can go, and another can be added. Re-cutting is not
            offered here: the cutout is an internal step, and the measure
            screen is where a bad one gets in the way. */}
        <div className="mt-3 flex shrink-0 items-baseline justify-center gap-6 text-12">
          {shown?.view === "detail" ? (
            <button
              type="button"
              className="link-text text-fg3"
              disabled={removing}
              onClick={() => onRemoveDetail(shown.id)}
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          ) : null}
          <Link
            href={`/capture?garment=${garment.id}&view=detail`}
            className="link-text text-fg3"
          >
            Add detail
          </Link>
        </div>
      </div>

      {/* Desktop only: brand and name on the left of the photo. */}
      <div className="hidden lg:col-start-1 lg:row-start-1 lg:sticky lg:top-(--item-aside-top) lg:block lg:self-start">
        {meta}
      </div>

      {/* The numbers always sit to the right of the garment, above what
          you can do about them. */}
      <div className="flex flex-col gap-8 sm:col-start-2 sm:self-center lg:col-start-3 lg:row-start-1 lg:sticky lg:top-(--item-aside-top) lg:self-start">
        <div className="lg:hidden">{meta}</div>
        {details ? editor : info}
        {details ? null : actions}
      </div>
    </div>
  );
}
