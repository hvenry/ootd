"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { X } from "@phosphor-icons/react";

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
  /** Has at least one measurement. Unmeasured garments say so on the tile. */
  measured: boolean;
  createdAt: string;
};

type Sort = "relevance" | "latest" | "oldest" | "brand";

const SORTS: readonly (readonly [Sort, string])[] = [
  ["relevance", "Best match"],
  ["latest", "Latest"],
  ["oldest", "Oldest"],
  ["brand", "Brand: A to Z"],
];

const isSort = (v: string | null): v is Sort =>
  SORTS.some(([value]) => value === v);

/** Where the item page's Back returns to: the closet as it was last left. */
export const CLOSET_HREF_KEY = "ootd:closet-href";
/** Set when a tile is opened, so the item page knows history holds the closet. */
export const FROM_CLOSET_KEY = "ootd:from-closet";

export function ClosetBrowser({
  items,
  prompt,
}: {
  items: ClosetItem[];
  /** A line over the grid, inside its column rather than across the page. */
  prompt?: React.ReactNode;
}) {
  const params = useSearchParams();
  const paramsKey = params.toString();
  // Filters, sort and search all live in the URL, so Back from an item
  // returns to the closet as it was left, a refresh keeps it, and an item
  // page can link "what else like this?" as a plain href.
  const { categories, brands, colours } = useMemo(() => {
    const read = (key: string) => new Set(params.getAll(key).filter(Boolean));
    return {
      categories: read("category"),
      brands: read("brand"),
      colours: read("colour"),
    };
  }, [params]);
  const query = params.get("q") ?? "";
  const searching = query.trim().length > 0;
  // A search ranks by match unless a sort is picked; best match means
  // nothing without a search, so it falls back to latest.
  const defaultSort: Sort = searching ? "relevance" : "latest";
  const asked = params.get("sort");
  const sort: Sort =
    isSort(asked) && (asked !== "relevance" || searching) ? asked : defaultSort;
  const sorts = SORTS.filter(([value]) => value !== "relevance" || searching);
  /** Which full-screen panel is open on small screens */
  const [panel, setPanel] = useState<"refine" | "sort" | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        CLOSET_HREF_KEY,
        `/${paramsKey ? `?${paramsKey}` : ""}`,
      );
    } catch {}
  }, [paramsKey]);

  // The native history call rather than the router: it updates
  // useSearchParams without a server round trip on every tap, and replacing
  // rather than pushing keeps Back meaning "leave the closet".
  function update(edit: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(paramsKey);
    edit(next);
    const qs = next.toString();
    window.history.replaceState(null, "", `/${qs ? `?${qs}` : ""}`);
  }

  function toggle(key: "category" | "brand" | "colour", value: string) {
    update((next) => {
      const values = next.getAll(key);
      next.delete(key);
      const kept = values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value];
      for (const v of kept) next.append(key, v);
    });
  }

  function setSort(value: Sort) {
    update((next) => {
      if (value === defaultSort) next.delete("sort");
      else next.set("sort", value);
    });
  }

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
    let filtered = items.filter(
      (i) =>
        (categories.size === 0 || categories.has(i.category)) &&
        (brands.size === 0 || brands.has(i.brand ?? "Unbranded")) &&
        (colours.size === 0 ||
          (i.declaredColour != null && colours.has(i.declaredColour))),
    );
    // Anything that can be said about a garment is in its haystack. A
    // search narrows, then ranks only if no other sort was asked for.
    if (searching) {
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
      if (sort === "relevance") {
        scored.sort((a, b) => b.score - a.score);
        return scored.map((s) => s.i);
      }
      filtered = scored.map((s) => s.i);
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
  }, [items, categories, brands, colours, sort, query, searching]);

  const activeCount = categories.size + brands.size + colours.size;

  function clearQuery() {
    update((next) => next.delete("q"));
  }

  // The sort is a preference, not a filter, so it survives Clear all.
  function clearAll() {
    update((next) => {
      for (const key of ["q", "category", "brand", "colour"]) next.delete(key);
    });
  }

  const active: ActiveFilter[] = [
    ...(query.trim()
      ? [{ key: "q", label: `“${query.trim()}”`, onRemove: clearQuery }]
      : []),
    ...[...categories].map((c) => ({
      key: `category-${c}`,
      label: CATEGORY_LABELS[c as Category] ?? c,
      onRemove: () => toggle("category", c),
    })),
    ...[...brands].map((b) => ({
      key: `brand-${b}`,
      label: b,
      onRemove: () => toggle("brand", b),
    })),
    ...[...colours].map((c) => ({
      key: `colour-${c}`,
      label: c,
      swatch: declaredHex(c),
      onRemove: () => toggle("colour", c),
    })),
  ];

  const categoryList = (
    <FilterGroup heading="Categories">
      {allCategories.map((c) => (
        <FilterRow
          key={c}
          label={CATEGORY_LABELS[c]}
          uppercase
          selected={categories.has(c)}
          onClick={() => toggle("category", c)}
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
          onClick={() => toggle("brand", b)}
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
            onClick={() => toggle("colour", c)}
          />
        ))}
      </FilterGroup>
    ) : null;

  const sortList = (
    <FilterGroup heading="Sort">
      {sorts.map(([value, label]) => (
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
              onClick={() => toggle("brand", b)}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Category and brand sit on the left gutter, sort and colour on the
          right, all flush with the header above them; the grid takes what
          is left. Colour is the short list, so it balances the long one. */}
      <div className="lg:flex lg:gap-16">
        <aside className="hidden w-44 shrink-0 lg:block">
          {categoryList}
          {brandList}
        </aside>

        <div className="min-w-0 flex-1">
          {prompt}
          <ActiveFilters filters={active} onClearAll={clearAll} />
          <Grid
            items={visible}
            onClear={active.length > 0 ? clearAll : undefined}
          />
        </div>

        <aside className="hidden w-28 shrink-0 lg:block">
          {sortList}
          {colourList}
        </aside>
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
            {sorts.map(([value, label]) => (
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
            onCategory={(c) => toggle("category", c)}
            onBrand={(b) => toggle("brand", b)}
            onColour={(c) => toggle("colour", c)}
          />
        )}
      </Sheet>
    </>
  );
}

type ActiveFilter = {
  key: string;
  label: string;
  swatch?: string | null;
  onRemove: () => void;
};

/**
 * What is narrowing the grid, over it: one chip per filter, each with its
 * own way out, so undoing one does not mean finding it again in a column or
 * a sheet. Clear all appears once there is more than one thing to clear.
 */
function ActiveFilters({
  filters,
  onClearAll,
}: {
  filters: ActiveFilter[];
  onClearAll: () => void;
}) {
  if (filters.length === 0) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {filters.map((f) => (
        <button
          key={f.key}
          type="button"
          className="chip gap-2 py-2 pr-2.5 pl-3"
          aria-label={`Remove filter: ${f.label}`}
          onClick={f.onRemove}
        >
          {f.swatch ? (
            <span aria-hidden className="swatch" style={{ background: f.swatch }} />
          ) : null}
          {f.label}
          <X size={12} weight="bold" aria-hidden />
        </button>
      ))}
      {filters.length > 1 ? (
        <button
          type="button"
          className="label link-text ml-2 cursor-pointer"
          onClick={onClearAll}
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}

function Grid({
  items,
  onClear,
}: {
  items: ClosetItem[];
  /** Offered when filters or a search are what emptied the grid. */
  onClear?: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-fg2 text-12">Nothing matches.</p>
        {onClear ? (
          <button
            type="button"
            className="chip mt-6"
            onClick={onClear}
          >
            Clear filters
          </button>
        ) : null}
      </div>
    );
  }
  return (
    /* Three across at most. Tops share one scale sized for a hoodie with its
       arms out, so a tee fills little of its tile, and at four across that
       read as a thumbnail. */
    <ul className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-8 xl:gap-x-10">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/item/${item.id}`}
            className="block"
            onClick={() => {
              try {
                sessionStorage.setItem(FROM_CLOSET_KEY, item.id);
              } catch {}
            }}
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
          {/* Outside the tile's link, which cannot hold another. Straight to
              measuring this one, not the queue. */}
          {item.measured ? null : (
            <Link
              href={`/measure/${item.id}`}
              className="btn-secondary mt-3 px-3 py-1.5"
            >
              To measure
            </Link>
          )}
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
