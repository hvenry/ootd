/**
 * The colour a person names when they capture a garment. A dozen words is
 * enough to describe most clothes; the extractor (garment_colour, OKLCH
 * clusters) refines it from the photograph later. The name is what is
 * stored and filtered on; the hex is only for drawing the swatch.
 */
export const DECLARED_COLOURS: readonly (readonly [string, string])[] = [
  ["Black", "#000000"],
  ["Charcoal", "#3A3A3A"],
  ["Grey", "#808080"],
  ["White", "#FFFFFF"],
  ["Cream", "#F1E9D6"],
  ["Beige", "#C8B89A"],
  ["Tan", "#B08A5A"],
  ["Khaki", "#8A7F4E"],
  ["Brown", "#6B4A2F"],
  ["Olive", "#556B2F"],
  ["Green", "#2E6B45"],
  ["Teal", "#2A7F7A"],
  ["Navy", "#1B2A4A"],
  ["Blue", "#2D5FA8"],
  ["Light blue", "#8FB3D9"],
  ["Purple", "#5B3A78"],
  ["Pink", "#D98BA5"],
  ["Red", "#A62B26"],
  ["Burgundy", "#6E1F2B"],
  ["Orange", "#D9722C"],
  ["Yellow", "#D9B02C"],
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
