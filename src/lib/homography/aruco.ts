import type { ArucoMarker } from "js-aruco2";

import { AR } from "./aruco-lib";

import {
  A3_SHEET_VERSION,
  DICTIONARY_NAME,
  LAYOUT_IDS,
  PX_PER_MM,
  SHEET_VERSION,
  greyPatchCanvas,
  layoutCanvasCorners,
  sheetVersionFromIds,
  type Layout,
  type Rig,
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
  /** Which printed markers were found, and so whose spans solved it. */
  layout: Layout;
  /** Corner marker centres in the original image, clockwise from top-left. */
  cornersInImage: Point[];
  sheetVersion: number;
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

const LAYOUT_NAMES: Record<Layout, string> = {
  rig: "the taped rig",
  a3: "the A3 sheet",
};

/**
 * Detect the markers in a full-resolution frame and solve its homography.
 * Returns a failure describing what was seen rather than throwing, because
 * "three of four markers" is a UI hint, not an exception.
 *
 * The IDs in frame say which layout this is, the rig's (0 to 3) or the A3
 * sheet's (4 to 7), so the right spans are used without anything being
 * switched by hand. `allowed` is the layouts this shot may be taken on.
 */
export function detectSheet(
  source: HTMLCanvasElement | OffscreenCanvas,
  rig: Rig,
  allowed: readonly Layout[] = ["rig", "a3"],
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

  // The layout with the most of its corners in frame is the one being used.
  const seen = (layout: Layout) =>
    LAYOUT_IDS[layout].filter((id) => byId.has(id)).length;
  const layout: Layout = seen("a3") > seen("rig") ? "a3" : "rig";
  const ids = LAYOUT_IDS[layout];
  const found = seen(layout);

  if (found === 0) {
    return {
      reason: "No markers found. Fill more of the frame and shoot straight down.",
      markerIds,
    };
  }
  if (!allowed.includes(layout)) {
    const wanted = allowed.map((l) => LAYOUT_NAMES[l]).join(" or ");
    return {
      reason: `This is ${LAYOUT_NAMES[layout]}; this photo goes on ${wanted}.`,
      markerIds,
    };
  }
  if (found < ids.length) {
    return {
      reason: `Found ${found} of 4 corner markers. Keep all four corners in shot.`,
      markerIds,
    };
  }

  // Marker IDs name their corner, so ordering needs no geometry.
  const cornersInImage = ids.map((id) => {
    const c = centroid(byId.get(id)!.corners);
    return { x: c.x / scale, y: c.y / scale };
  });

  let homography: Matrix3;
  try {
    homography = getPerspectiveTransform(
      cornersInImage,
      layoutCanvasCorners(layout, rig),
    );
  } catch {
    return {
      reason: "Markers are collinear — reshoot from straight above.",
      markerIds,
    };
  }

  return {
    homography,
    pxPerMm: PX_PER_MM,
    layout,
    cornersInImage,
    // The version markers are no longer printed, so this normally comes
    // from configuration; a rig that does carry them still wins.
    sheetVersion:
      layout === "a3"
        ? A3_SHEET_VERSION
        : (sheetVersionFromIds(markerIds) ?? SHEET_VERSION),
    markerIds,
    greyPatchRgb: sampleGreyPatch(source, homography, greyPatchCanvas(layout, rig)),
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
  patchInCanvas: Point,
): [number, number, number] | null {
  try {
    const inverse = invertHomography(homography);
    // Inset hard, so a little print misregistration cannot pull in paper.
    const inset = 8;
    const centre = applyHomography(inverse, patchInCanvas);
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
