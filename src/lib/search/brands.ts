import { fuzzyScore } from "@/lib/search/fuzzy";
import { STARTER_BRANDS } from "@/lib/search/starter-brands";

/** A brand to suggest. `count` is how many the closet holds; 0 = not owned. */
export type KnownBrand = { name: string; count: number };

/**
 * What two spellings of one brand have in common: "Levi's", "levis" and
 * "LEVIS" are all `levis`, and "Acne Studios" is `acnestudios`. Used both to
 * match what is typed and to stop one brand appearing twice.
 */
export function brandKey(name: string): string {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function words(name: string): string[] {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * The closet's brands, then the starter list behind them.
 *
 * The starter list is only there so the first garment of a brand does not
 * have to be spelled from memory. Where the closet already has a brand, its
 * spelling wins, even over the list's: the closet filters on the exact
 * string, and a suggestion that differs from what is stored would split one
 * brand in two.
 */
export function withStarterBrands(owned: KnownBrand[]): KnownBrand[] {
  const seen = new Set(owned.map((b) => brandKey(b.name)));
  const starters = STARTER_BRANDS.filter((name) => {
    const key = brandKey(name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((name) => ({ name, count: 0 }));
  return [...owned, ...starters];
}

/**
 * Brands matching what has been typed, best first.
 *
 * A name that starts with the query beats one with a later word that does,
 * which beats a fuzzy hit anywhere; so "s" puts Sears above Acne Studios,
 * and both above a brand that merely contains an s. Within a tier, brands
 * owned come first and more-owned before less.
 *
 * Only an identical spelling is dropped. "levi's" against a stored "Levis"
 * is the same brand spelled differently, and offering the stored spelling
 * is the whole point: taken as typed, it would become a second brand.
 */
export function matchBrands(
  query: string,
  brands: KnownBrand[],
  limit = 6,
): KnownBrand[] {
  const q = brandKey(query);
  if (!q) return [];
  const typed = query.trim();
  return brands
    .flatMap((brand) => {
      const key = brandKey(brand.name);
      if (brand.name === typed) return [];
      const starts = key.startsWith(q);
      const wordStart = words(brand.name).some((w) => w.startsWith(q));
      const fuzzy = fuzzyScore(q, key);
      if (!starts && !wordStart && fuzzy === null) return [];
      const rank = key === q ? 4 : starts ? 3 : wordStart ? 2 : 1;
      return [{ brand, rank, fuzzy: fuzzy ?? 0 }];
    })
    .sort(
      (a, b) =>
        b.rank - a.rank ||
        b.brand.count - a.brand.count ||
        b.fuzzy - a.fuzzy ||
        a.brand.name.localeCompare(b.brand.name),
    )
    .slice(0, limit)
    .map((m) => m.brand);
}
