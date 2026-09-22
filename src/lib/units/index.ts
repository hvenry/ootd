/**
 * The only place millimetres become anything else.
 *
 * The database stores integer millimetres, always. Inches exist here and in no
 * other file; if a component wants inches it asks this module at render time.
 */

export type DisplayUnit = "mm" | "cm" | "in";

const MM_PER_INCH = 25.4;

/** Round to integer mm. Every value entering the database goes through this. */
export function toMm(value: number): number {
  return Math.round(value);
}

/** Canvas pixels to integer millimetres, given the canvas scale. */
export function pxToMm(px: number, pxPerMm: number): number {
  return toMm(px / pxPerMm);
}

export function mmToPx(mm: number, pxPerMm: number): number {
  return mm * pxPerMm;
}

/**
 * Format for display. Inches render as eighths because that is how every
 * brand size chart in this wardrobe is written.
 */
export function formatLength(mm: number, unit: DisplayUnit = "mm"): string {
  switch (unit) {
    case "mm":
      return `${mm}`;
    case "cm":
      return (mm / 10).toFixed(1);
    case "in":
      return formatInchesAsEighths(mm / MM_PER_INCH);
  }
}

function formatInchesAsEighths(inches: number): string {
  const whole = Math.floor(inches);
  const eighths = Math.round((inches - whole) * 8);
  if (eighths === 0) return `${whole}`;
  if (eighths === 8) return `${whole + 1}`;
  const divisor = gcd(eighths, 8);
  return `${whole} ${eighths / divisor}/${8 / divisor}`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function unitSuffix(unit: DisplayUnit): string {
  return unit === "in" ? '"' : unit;
}
