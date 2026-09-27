/**
 * The colour a person names when they capture a garment. Twelve plain words
 * cover most clothes, and fewer is faster to pick from; the extractor
 * (garment_colour, OKLCH clusters) refines it from the photograph later. The name is what is
 * stored and filtered on; the hex is only for drawing the swatch.
 */
export const DECLARED_COLOURS: readonly (readonly [string, string])[] = [
  ["Black", "#000000"],
  ["White", "#FFFFFF"],
  ["Gray", "#808080"],
  ["Brown", "#6B4A2F"],
  ["Beige", "#C8B89A"],
  ["Yellow", "#D9B02C"],
  ["Red", "#A62B26"],
  ["Orange", "#D9722C"],
  ["Pink", "#D98BA5"],
  ["Purple", "#5B3A78"],
  ["Blue", "#2D5FA8"],
  ["Green", "#2E6B45"],
];

export function declaredHex(name: string | null | undefined): string | null {
  const hit = DECLARED_COLOURS.find(([n]) => n === name);
  return hit ? hit[1] : null;
}

export function declaredName(hex: string | null | undefined): string | null {
  const hit = DECLARED_COLOURS.find(
    ([, h]) => h.toLowerCase() === (hex ?? "").toLowerCase(),
  );
  return hit ? hit[0] : null;
}

export function isDeclaredColour(name: string): boolean {
  return DECLARED_COLOURS.some(([n]) => n === name);
}
