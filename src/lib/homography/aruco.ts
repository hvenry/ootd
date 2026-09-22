import type { ArucoMarker } from "js-aruco2";

import { AR } from "./aruco-lib";

import {
  CORNER_IDS,
  DICTIONARY_NAME,
  GREY_PATCH,
  PX_PER_MM,
  offsetMmToCanvas,
  sheetCanvasCorners,
  sheetVersionFromIds,
} from "./sheet";
import {
  applyHomography,
  centroid,
  getPerspectiveTransform,
  invertHomography,
  type Matrix3,
  type Point,
} from "./solve";

/**
 * Marker detection is classical computer vision — thresholding, contours,
 * perspective-unwarping each candidate and reading its bits. It is not a
 * model, it wants no GPU, and reaching for one here would be a mistake.
 */

/**
 * Detection cost scales with pixel count, and a modern phone photo is ~12MP.
 * Detect on a downscale and scale the corners back up: marker corners are
 * localised to sub-pixel accuracy by the contour fit, so the precision lost
 * is far below the flatness error that actually bounds the measurement.
 */
const DETECT_MAX_DIMENSION = 1280;

export type SheetDetection = {
  /** Image pixels -> metric canvas pixels. */
  homography: Matrix3;
  pxPerMm: number;
  /** Corner marker centres in the original image, clockwise from top-left. */
  cornersInImage: Point[];
  sheetVersion: number | null;
  markerIds: number[];
  greyPatchRgb: [number, number, number] | null;
};

export type DetectionFailure = {
  reason: string;
  markerIds: number[];
};

export function detectMarkers(image: ImageData): ArucoMarker[] {
  const detector = new AR.Detector({ dictionaryName: DICTIONARY_NAME });
  return detector.detectImage(image.width, image.height, image.data);
}

/**
 * Detect the sheet in a full-resolution frame and solve its homography.
 * Returns a failure describing what was seen rather than throwing, because
 * "three of four markers" is a UI hint, not an exception.
 */
export function detectSheet(
  source: HTMLCanvasElement | OffscreenCanvas,
): SheetDetection | DetectionFailure {
  const { imageData, scale } = downscaleForDetection(source);
  const markers = detectMarkers(imageData);
  const markerIds = markers.map((m) => m.id);

  // Thresholding throws off the occasional phantom marker — a patch edge, a
  // garment corner. If one lands on a corner ID, keep whichever decoded with
  // the fewer bit errors rather than whichever was found last.
  const byId = new Map<number, ArucoMarker>();
  for (const m of markers) {
    const existing = byId.get(m.id);
    if (!existing || m.hammingDistance < existing.hammingDistance) {
      byId.set(m.id, m);
    }
  }

  const missing = CORNER_IDS.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    return {
      reason:
        missing.length === CORNER_IDS.length
          ? "No sheet found. Fill more of the frame and shoot straight down."
          : `Found ${CORNER_IDS.length - missing.length} of 4 corner markers. Keep all four corners in shot.`,
      markerIds,
    };
  }

  // Marker IDs name their corner, so ordering needs no geometry.
  const cornersInImage = CORNER_IDS.map((id) => {
    const c = centroid(byId.get(id)!.corners);
    return { x: c.x / scale, y: c.y / scale };
  });

  let homography: Matrix3;
  try {
    homography = getPerspectiveTransform(cornersInImage, sheetCanvasCorners());
  } catch {
    return {
      reason: "Markers are collinear — reshoot from straight above.",
      markerIds,
    };
  }

  return {
    homography,
    pxPerMm: PX_PER_MM,
    cornersInImage,
    sheetVersion: sheetVersionFromIds(markerIds),
    markerIds,
    greyPatchRgb: sampleGreyPatch(source, homography),
  };
}

export function isDetectionFailure(
  d: SheetDetection | DetectionFailure,
): d is DetectionFailure {
  return "reason" in d;
}

function downscaleForDetection(source: HTMLCanvasElement | OffscreenCanvas): {
  imageData: ImageData;
  scale: number;
} {
  const longest = Math.max(source.width, source.height);
  const scale = longest > DETECT_MAX_DIMENSION ? DETECT_MAX_DIMENSION / longest : 1;

  if (scale === 1) {
    const ctx = source.getContext("2d") as CanvasRenderingContext2D;
    return {
      imageData: ctx.getImageData(0, 0, source.width, source.height),
      scale: 1,
    };
  }

  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const ctx = small.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
  return { imageData: ctx.getImageData(0, 0, w, h), scale };
}

/**
 * Average the printed neutral patch, for a white-balance gain later.
 * The patch is at a known place on the sheet, so the inverse homography says
 * exactly where to look in the photo.
 */
function sampleGreyPatch(
  source: HTMLCanvasElement | OffscreenCanvas,
  homography: Matrix3,
): [number, number, number] | null {
  try {
    const inverse = invertHomography(homography);
    // Inset hard, so a little print misregistration cannot pull in paper.
    const inset = 8;
    const centre = applyHomography(
      inverse,
      offsetMmToCanvas(GREY_PATCH.offsetXMm, GREY_PATCH.offsetYMm),
    );
    const x = Math.round(centre.x - inset / 2);
    const y = Math.round(centre.y - inset / 2);
    if (x < 0 || y < 0 || x + inset > source.width || y + inset > source.height) {
      return null;
    }

    const ctx = source.getContext("2d") as CanvasRenderingContext2D;
    const { data } = ctx.getImageData(x, y, inset, inset);
    let r = 0;
    let g = 0;
    let b = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  } catch {
    return null;
  }
}
