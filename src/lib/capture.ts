import { eq } from "drizzle-orm";
import type { Matrix3 } from "@/lib/homography/solve";

/** The calibration a client sends alongside an uploaded frame. */
export type Calibration = {
  m: Matrix3;
  pxPerMm: number;
  sheetVersion?: number;
  greyPatchRgb?: number[] | null;
  cornersInImage?: { x: number; y: number }[] | null;
  source?: string;
};

export function parseCalibration(value: FormDataEntryValue | null): Calibration | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed?.m) || parsed.m.length !== 9) return null;
    return parsed as Calibration;
  } catch {
    return null;
  }
}

export function str(value: FormDataEntryValue | null): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length > 0 ? s : null;
}

export { eq };
