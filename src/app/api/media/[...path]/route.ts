import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

import { absolutePath } from "@/lib/storage";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

/**
 * Serve originals and cutouts off the volume.
 *
 * Deliberately not routed through next/image: on glibc Linux sharp can balloon
 * memory optimising large photographs, and the design system wants the natural
 * aspect ratio anyway.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  let absolute: string;
  try {
    absolute = absolutePath(segments.join("/"));
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const info = await stat(absolute);
    if (!info.isFile()) return new NextResponse("Not found", { status: 404 });

    const ext = absolute.slice(absolute.lastIndexOf(".")).toLowerCase();
    const stream = Readable.toWeb(
      createReadStream(absolute),
    ) as ReadableStream<Uint8Array>;

    return new NextResponse(stream, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Content-Length": String(info.size),
        // Content at a given path never changes; a new cutout is a new path.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
