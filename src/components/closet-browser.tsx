"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Sheet, SheetList, SheetRow } from "@/components/sheet";
import { declaredHex } from "@/lib/colour/declared";
import { fuzzyScore } from "@/lib/search/fuzzy";
import { PhotoStrip } from "@/components/photo-strip";

import { CATEGORY_LABELS, type Category } from "@/lib/measure/templates";

export type ClosetItem = {
  id: string;
  shortId: number;
  category: Category;
  brand: string | null;
  name: string | null;
  declaredColour: string | null;
  cutoutPath: string | null;
  /** The cutout cropped to the garment on a 3:4 canvas; what the grid shows. */
  tilePath: string | null;
  /** The back's tile, swiped to from the front. Null until it is cut. */
  backTilePath: string | null;
  /** The cutout job was refused, rather than still running. */
  cutFailed: boolean;
  createdAt: string;
};

type Sort = "latest" | "oldest" | "brand";

const SORTS: readonly (readonly [Sort, string])[] = [
  ["latest", "Latest"],
  ["oldest", "Oldest"],
  ["brand", "Brand: A to Z"],
];

const toggle = (set: Set<string>, value: string) => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};

export function ClosetBrowser({ items }: { items: ClosetItem[] }) {
  const params = useSearchParams();
  // Filters can arrive in the URL: an item page links its brand, category
  // and colour back here so "what else like this?" is one tap.
  const seed = (key: string) => new Set(params.getAll(key).filter(Boolean));
  const [categories, setCategories] = useState<Set<string>>(() =>
    seed("category"),
  );
  const [brands, setBrands] = useState<Set<string>>(() => seed("brand"));
  const [colours, setColours] = useState<Set<string>>(() => seed("colour"));
  const [sort, setSort] = useState<Sort>("latest");
  /** Which full-screen panel is open on small screens */
  const [panel, setPanel] = useState<"refine" | "sort" | null>(null);
  const query = params.get("q") ?? "";

  const allColours = useMemo(
    () =>
      Array.from(
        new Set(
          items.flatMap((i) => (i.declaredColour ? [i.declaredColour] : [])),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const allBrands = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.brand ?? "Unbranded"))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [items],
  );

  // Only offer a category that something in the closet actually is; an empty
  // filter is a dead end you can select.
  const allCategories = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.category))).sort((a, b) =>
        CATEGORY_LABELS[a].localeCompare(CATEGORY_LABELS[b]),
      ),
    [items],
  );

  const visible = useMemo(() => {
    const filtered = items.filter(
      (i) =>
        (categories.size === 0 || categories.has(i.category)) &&
        (brands.size === 0 || brands.has(i.brand ?? "Unbranded")) &&
        (colours.size === 0 ||
          (i.declaredColour != null && colours.has(i.declaredColour))),
    );
    // A search ranks by match quality and overrides the sort; anything that
    // can be said about a garment is in its haystack.
    if (query.trim()) {
      const scored = filtered.flatMap((i) => {
        const hay = [
          i.brand ?? "Unbranded",
          i.name ?? "",
          i.declaredColour ?? "",
          CATEGORY_LABELS[i.category],
          String(i.shortId).padStart(3, "0"),
        ].join(" ");
        const score = fuzzyScore(query, hay);
        return score === null ? [] : [{ i, score }];
      });
      scored.sort((a, b) => b.score - a.score);
      return scored.map((s) => s.i);
    }
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return a.createdAt.localeCompare(b.createdAt);
        case "brand":
          return (a.brand ?? "Unbranded").localeCompare(b.brand ?? "Unbranded");
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
    return sorted;
  }, [items, categories, brands, colours, sort, query]);

  const activeCount = categories.size + brands.size + colours.size;

  const categoryList = (
    <FilterGroup heading="Categories">
      {allCategories.map((c) => (
        <FilterRow
          key={c}
          label={CATEGORY_LABELS[c]}
          uppercase
          selected={categories.has(c)}
          onClick={() => setCategories((s) => toggle(s, c))}
        />
      ))}
    </FilterGroup>
  );

  const brandList = (
    <FilterGroup heading="Brands">
      {allBrands.map((b) => (
        <FilterRow
          key={b}
          label={b}
          selected={brands.has(b)}
          onClick={() => setBrands((s) => toggle(s, b))}
        />
      ))}
    </FilterGroup>
  );

  const colourList =
    allColours.length > 0 ? (
      <FilterGroup heading="Colours">
        {allColours.map((c) => (
          <FilterRow
            key={c}
            label={c}
            swatch={declaredHex(c)}
            selected={colours.has(c)}
            onClick={() => setColours((s) => toggle(s, c))}
          />
        ))}
      </FilterGroup>
    ) : null;

  const sortList = (
    <FilterGroup heading="Sort">
      {SORTS.map(([value, label]) => (
        <FilterRow
          key={value}
          label={label}
          selected={sort === value}
          onClick={() => {
            setSort(value);
            setPanel(null);
          }}
        />
      ))}
    </FilterGroup>
  );

  return (
    <>
      {/* What the filter columns become below lg: the Filter | Sort bar,
          bleeding to the viewport edges, then a scrolling row of brands. */}
      <div className="-mx-gutter lg:hidden">
        <div className="split-bar">
          <button
            type="button"
            className="label cursor-pointer py-3"
            onClick={() => setPanel("refine")}
          >
            Filter{activeCount > 0 ? ` (${activeCount})` : ""}
          </button>
          <button
            type="button"
            className="label cursor-pointer py-3"
            onClick={() => setPanel("sort")}
          >
            Sort
          </button>
        </div>
        <div className="flex gap-2.5 overflow-x-auto px-gutter py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {allBrands.map((b) => (
            <button
              key={b}
              type="button"
              className="chip shrink-0 whitespace-nowrap"
              aria-pressed={brands.has(b)}
              onClick={() => setBrands((s) => toggle(s, b))}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Filters sit on the left gutter and sort on the right, both flush
          with the header above them; the grid takes what is left. */}
      <div className="lg:flex lg:gap-16">
        <aside className="hidden w-44 shrink-0 lg:block">
          {categoryList}
          {brandList}
          {colourList}
        </aside>

        <div className="min-w-0 flex-1">
          <Grid items={visible} />
        </div>

        <aside className="hidden w-28 shrink-0 lg:block">{sortList}</aside>
      </div>

      <Sheet
        open={panel !== null}
        title={panel === "sort" ? "Sort" : "Closet"}
        className="lg:hidden"
        onClose={() => setPanel(null)}
        footer={
          panel === "refine" ? (
            <button
              type="button"
              className="btn-primary w-full py-5"
              onClick={() => setPanel(null)}
            >
              View {visible.length} item{visible.length === 1 ? "" : "s"}
            </button>
          ) : null
        }
      >
        {panel === "sort" ? (
          <SheetList>
            {SORTS.map(([value, label]) => (
              <SheetRow
                key={value}
                label={label}
                selected={sort === value}
                onClick={() => {
                  setSort(value);
                  setPanel(null);
                }}
              />
            ))}
          </SheetList>
        ) : (
          <RefineSheet
            categories={allCategories}
            brands={allBrands}
            colours={allColours}
            selectedCategories={categories}
            selectedBrands={brands}
            selectedColours={colours}
            onCategory={(c) => setCategories((s) => toggle(s, c))}
            onBrand={(b) => setBrands((s) => toggle(s, b))}
            onColour={(c) => setColours((s) => toggle(s, c))}
          />
        )}
      </Sheet>
    </>
  );
}

function Grid({ items }: { items: ClosetItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-fg2 py-24 text-center text-12">Nothing matches.</p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-8 xl:grid-cols-4 xl:gap-x-10">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/item/${item.id}`}
            className="block"
            draggable={false}
            /* Otherwise a swipe on the tile also starts the browser's own
               drag of the link, with a ghost URL under the cursor. */
            onDragStart={(event) => event.preventDefault()}
          >
            {/* Every tile is the same 3:4 box, so the names under a row sit on
                one line whatever shape the garments are. The fallback is the
                full-frame cutout, for anything cut before tiles existed. */}
            {item.tilePath || item.cutoutPath ? (
              <Tile item={item} />
            ) : (
              <div className="border-rule text-fg3 label flex aspect-[3/4] items-end border-b p-2">
                {item.cutFailed ? "Cut failed" : "Cutting out"}
              </div>
            )}
            <div className="mt-4">
              <p className="label">{item.brand ?? "Unbranded"}</p>
              <p className="text-fg2">{item.name ?? "Untitled"}</p>
              <p className="data text-fg3 mt-1">
                {String(item.shortId).padStart(3, "0")}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * One garment's photos in the grid. Swipe to see the back; the swipe swallows
 * the click so the link under it does not also open.
 */
function Tile({ item }: { item: ClosetItem }) {
  const [index, setIndex] = useState(0);
  const front = {
    id: `${item.id}-front`,
    src: `/api/media/${item.tilePath ?? item.cutoutPath}`,
    fallback: `/api/media/${item.cutoutPath}`,
    alt: item.name ?? "Garment",
  };
  const photos = item.backTilePath
    ? [
        front,
        {
          id: `${item.id}-back`,
          src: `/api/media/${item.backTilePath}`,
          fallback: `/api/media/${item.backTilePath}`,
          alt: `${item.name ?? "Garment"}, back`,
        },
      ]
    : [front];
  return (
    <PhotoStrip
      photos={photos}
      index={index}
      onIndexChange={setIndex}
      className="aspect-[3/4]"
      imgClassName="h-full"
    />
  );
}

function FilterGroup({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  // Column heads are full-strength labels, flush with the rows beneath.
  return (
    <section className="mb-8">
      <p className="label mb-1.5 font-semibold">{heading}</p>
      <ul>{children}</ul>
    </section>
  );
}

/**
 * A filter is a line of text, not a box: flush left, one line high, and the
 * selected one is underlined. No marker and no indent, so the column reads as
 * a list of words under its head.
 */
function FilterRow({
  label,
  selected,
  uppercase = false,
  swatch,
  onClick,
}: {
  label: string;
  selected: boolean;
  uppercase?: boolean;
  /** A hex to draw beside the word; colour rows only. */
  swatch?: string | null;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`tab inline-flex items-center gap-1.5 text-left leading-[1.35] ${
          uppercase ? "uppercase" : ""
        }`}
      >
        {swatch ? (
          <span aria-hidden className="swatch" style={{ background: swatch }} />
        ) : null}
        {label}
      </button>
    </li>
  );
}

function RefineSheet({
  categories,
  brands,
  colours,
  selectedCategories,
  selectedBrands,
  selectedColours,
  onCategory,
  onBrand,
  onColour,
}: {
  categories: Category[];
  brands: string[];
  colours: string[];
  selectedCategories: Set<string>;
  selectedBrands: Set<string>;
  selectedColours: Set<string>;
  onCategory: (c: Category) => void;
  onBrand: (b: string) => void;
  onColour: (c: string) => void;
}) {
  const [tab, setTab] = useState<"categories" | "brands" | "colours">(
    "categories",
  );
  const tabs = (["categories", "brands", "colours"] as const).filter(
    (t) => t !== "colours" || colours.length > 0,
  );

  function rows() {
    switch (tab) {
      case "brands":
        return brands.map((b) => ({
          key: b,
          label: b,
          selected: selectedBrands.has(b),
          onClick: () => onBrand(b),
        }));
      case "colours":
        return colours.map((c) => ({
          key: c,
          label: c,
          selected: selectedColours.has(c),
          onClick: () => onColour(c),
        }));
      default:
        return categories.map((c) => ({
          key: c,
          label: CATEGORY_LABELS[c],
          selected: selectedCategories.has(c),
          onClick: () => onCategory(c),
        }));
    }
  }

  return (
    <>
      <p className="label text-fg3 pt-4">Select a filter</p>
      <div className="flex gap-8 pt-8 pb-6">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className="label tab"
          >
            {t}
          </button>
        ))}
      </div>
      <SheetList>
        {rows().map((row) => (
          <SheetRow
            key={row.key}
            label={row.label}
            selected={row.selected}
            onClick={row.onClick}
          />
        ))}
      </SheetList>
    </>
  );
}
