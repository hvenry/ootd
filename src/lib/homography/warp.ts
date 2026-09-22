import { invertHomography, type Matrix3 } from "./solve";

/**
 * Render the metric canvas, for the user to confirm the sheet was found.
 *
 * This is a *preview* and nothing else. Measurements are taken by pushing tap
 * coordinates through the homography, never by measuring these pixels: warping
 * and then measuring the warp resamples twice and spends precision for a
 * picture. See CLAUDE.md.
 */
const PREVIEW_MAX_DIMENSION = 720;

export function renderWarpPreview(
  source: HTMLCanvasElement,
  homography: Matrix3,
  canvasWidth: number,
  canvasHeight: number,
): HTMLCanvasElement {
  const scale = Math.min(
    1,
    PREVIEW_MAX_DIMENSION / Math.max(canvasWidth, canvasHeight),
  );
  const outW = Math.max(1, Math.round(canvasWidth * scale));
  const outH = Math.max(1, Math.round(canvasHeight * scale));

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const outCtx = out.getContext("2d")!;

  const srcCtx = source.getContext("2d", { willReadFrequently: true })!;
  const src = srcCtx.getImageData(0, 0, source.width, source.height);
  const dst = outCtx.createImageData(outW, outH);

  const inv = invertHomography(homography);
  const [a, b, c, d, e, f, g, h, i] = inv;

  for (let y = 0; y < outH; y++) {
    // Canvas coordinates, undoing the preview downscale.
    const cy = y / scale;
    for (let x = 0; x < outW; x++) {
      const cx = x / scale;

      const w = g * cx + h * cy + i;
      const sx = (a * cx + b * cy + c) / w;
      const sy = (d * cx + e * cy + f) / w;

      const o = (y * outW + x) * 4;
      if (sx < 0 || sy < 0 || sx >= src.width - 1 || sy >= src.height - 1) {
        dst.data[o + 3] = 0;
        continue;
      }

      bilinear(src, sx, sy, dst.data, o);
    }
  }

  outCtx.putImageData(dst, 0, 0);
  return out;
}

function bilinear(
  src: ImageData,
  sx: number,
  sy: number,
  out: Uint8ClampedArray,
  o: number,
) {
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const fx = sx - x0;
  const fy = sy - y0;

  const i00 = (y0 * src.width + x0) * 4;
  const i10 = i00 + 4;
  const i01 = i00 + src.width * 4;
  const i11 = i01 + 4;

  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;

  for (let ch = 0; ch < 3; ch++) {
    out[o + ch] =
      src.data[i00 + ch] * w00 +
      src.data[i10 + ch] * w10 +
      src.data[i01 + ch] * w01 +
      src.data[i11 + ch] * w11;
  }
  out[o + 3] = 255;
}

type Decoded = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
  release: () => void;
};

/**
 * Decode a phone photo, by whichever route this browser actually supports.
 *
 * iPhones shoot HEIC, and Safari has historically refused both the options
 * bag and HEIC through `createImageBitmap` while decoding both perfectly well
 * in an <img>. So: try the good path, then the element, which uses the
 * browser's own decoder and handles what the first will not.
 *
 * **Every path here must honour EXIF orientation.** A bare
 * `createImageBitmap(file)` defaults to `imageOrientation: "none"` and
 * silently un-rotates a phone photo; an <img> applies EXIF like any image on
 * a page. Mixing the two is worse than either, because the homography would
 * then be solved in a different frame from the one the worker cuts out —
 * the coordinates would not match the pixels and the millimetres would be
 * quietly wrong rather than merely sideways.
 */
async function decodeImage(file: File): Promise<Decoded> {
  const attempts: (() => Promise<Decoded>)[] = [
    async () => {
      const b = await createImageBitmap(file, { imageOrientation: "from-image" });
      return bitmapDecoded(b);
    },
    async () => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      try {
        await img.decode();
      } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
      }
      return {
        width: img.naturalWidth,
        height: img.naturalHeight,
        draw: (ctx) => ctx.drawImage(img, 0, 0),
        release: () => URL.revokeObjectURL(url),
      };
    },
  ];

  const reasons: string[] = [];
  for (const attempt of attempts) {
    try {
      const decoded = await attempt();
      if (decoded.width > 0 && decoded.height > 0) return decoded;
      reasons.push("decoded to zero size");
      decoded.release();
    } catch (error) {
      reasons.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(
    `Could not decode ${file.type || "this file"} (${Math.round(file.size / 1024)}kB). ` +
      `Tried three decoders: ${reasons.join("; ")}. ` +
      `On an iPhone, Settings → Camera → Formats → "Most Compatible" shoots JPEG instead of HEIC.`,
  );
}

function bitmapDecoded(bitmap: ImageBitmap): Decoded {
  return {
    width: bitmap.width,
    height: bitmap.height,
    draw: (ctx) => ctx.drawImage(bitmap, 0, 0),
    release: () => bitmap.close(),
  };
}

/** Decode a File into a canvas at full resolution, honouring EXIF orientation. */
export async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const decoded = await decodeImage(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("This browser would not give us a 2D canvas");
    decoded.draw(ctx);

    // A canvas can be allocated and still refuse to be read back — iOS caps
    // total canvas area, and past it getImageData returns blank rather than
    // throwing. Detection on a blank frame finds nothing and reads as "no
    // sheet", so check here where the real cause is still visible.
    const probe = ctx.getImageData(0, 0, 1, 1).data;
    if (probe[3] === 0) {
      throw new Error(
        `The decoded image (${decoded.width}×${decoded.height}, ` +
          `${(decoded.width * decoded.height) / 1e6}MP) came back blank — ` +
          `this device will not give us a canvas that large.`,
      );
    }

    return canvas;
  } finally {
    decoded.release();
  }
}
