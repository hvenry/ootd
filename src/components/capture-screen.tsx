"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { finishCapture } from "@/app/actions";
import { useActivity } from "@/components/activity";
import { DetailShots } from "@/components/detail-shots";
import { GarmentForm, type GarmentDraft } from "@/components/garment-form";
import { GarmentOutline } from "@/components/garment-hint";
import type { KnownBrand } from "@/lib/search/brands";
import {
  detectSheet,
  isDetectionFailure,
  type SheetDetection,
} from "@/lib/homography/aruco";
import {
  quadCheckMm,
  SHEET_VERSION,
  sheetCanvasSize,
} from "@/lib/homography/sheet";
import { fileToCanvas, renderWarpPreview } from "@/lib/homography/warp";
import { silhouetteFor, type PhotoView } from "@/lib/measure/templates";

type Mode = "idle" | "detecting" | "found" | "failed" | "saving";
/**
 * Details first, then one photograph per face, then any close-ups. The
 * close-ups are their own stage because they skip everything the faces
 * need: no markers, no homography, no cutout.
 */
type Stage = "details" | "shoot" | "closeups";

/** A phone photo is far larger than the box it is shown in; drawing it at
    full resolution costs tens of megabytes of canvas for no visible gain. */
const PREVIEW_MAX_PX = 900;
/** Both previews sit in the same box, so the two agree by construction. */
const PREVIEW_CLASS = "block h-auto max-h-[70vh] w-full object-contain";

/** Above this the two diagonals disagree by more than any rig should. */
const RIG_TOLERANCE_MM = 5;

const VIEW_LABELS: Record<PhotoView, string> = {
  front: "Front",
  back: "Back",
  detail: "Detail",
};

export function CaptureScreen({ brands }: { brands: KnownBrand[] }) {
  const router = useRouter();
  const { toast } = useActivity();
  // With ?garment=&view= this shoots one more view of a garment that already
  // exists, which is how the measure screen sends you back for a missing
  // face, rather than walking the whole three-step flow.
  const search = useSearchParams();
  const existingGarmentId = search.get("garment");
  const requestedView = (search.get("view") ?? "front") as PhotoView;
  const singleView = existingGarmentId !== null;

  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<File | null>(null);
  const previewHostRef = useRef<HTMLDivElement | null>(null);
  const originalHostRef = useRef<HTMLDivElement | null>(null);

  const [stage, setStage] = useState<Stage>(
    !singleView ? "details" : requestedView === "detail" ? "closeups" : "shoot",
  );
  const [draft, setDraft] = useState<GarmentDraft>({
    // Opens on tops, short sleeve: the types are showing from the start.
    group: "top",
    topType: "top",
    colour: "",
    category: null,
    brand: "",
    name: "",
  });
  /** Set the moment the front is uploaded; every later view attaches to it. */
  const [garmentId, setGarmentId] = useState<string | null>(existingGarmentId);
  const [shooting, setShooting] = useState<PhotoView>(
    singleView ? requestedView : "front",
  );

  const [mode, setMode] = useState<Mode>("idle");
  const [message, setMessage] = useState<string | null>(null);
  /** What the browser actually handed us, so a failure is diagnosable. */
  const [fileInfo, setFileInfo] = useState<string | null>(null);
  const [detection, setDetection] = useState<SheetDetection | null>(null);
  /**
   * Whether the client bundle actually came alive on this device.
   *
   * The button is a <label> wrapping a hidden <input>, so the file picker
   * opens through plain browser behaviour with no JavaScript at all. If
   * hydration failed, picking a photo therefore looks *exactly* like the
   * button doing nothing, which is indistinguishable from a decode failure
   * unless the page says so itself.
   */
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    const onError = (e: ErrorEvent) =>
      setClientError(
        `${e.message}${e.filename ? ` @ ${e.filename.split("/").pop()}:${e.lineno}` : ""}`,
      );
    const onRejection = (e: PromiseRejectionEvent) =>
      setClientError(
        `unhandled: ${e.reason instanceof Error ? e.reason.message : String(e.reason)}`,
      );
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  const showOriginal = useCallback((canvas: HTMLCanvasElement) => {
    const host = originalHostRef.current;
    if (!host) return;
    host.replaceChildren();
    const shown = document.createElement("canvas");
    const scale = Math.min(
      1,
      PREVIEW_MAX_PX / Math.max(canvas.width, canvas.height),
    );
    shown.width = Math.round(canvas.width * scale);
    shown.height = Math.round(canvas.height * scale);
    shown.getContext("2d")!.drawImage(canvas, 0, 0, shown.width, shown.height);
    shown.className = PREVIEW_CLASS;
    shown.dataset.scale = String(scale);
    host.append(shown);
  }, []);

  // The preview host only exists once a detection has rendered, so this runs
  // after that render rather than inline with the solve. Otherwise it draws
  // into a ref that is still null and the metric canvas silently stays empty.
  useEffect(() => {
    const host = previewHostRef.current;
    const source = sourceRef.current;
    if (!detection || !host || !source) return;
    const { width, height } = sheetCanvasSize();
    const preview = renderWarpPreview(
      source,
      detection.homography,
      width,
      height,
    );
    preview.className = PREVIEW_CLASS;
    host.replaceChildren(preview);
  }, [detection]);

  /**
   * Drop everything belonging to the photograph just dealt with.
   *
   * A full-resolution phone photo decodes to tens of megabytes of canvas.
   * Holding the front's while the back is being shot is how a capture flow
   * gets killed by the tab running out of memory on the second photo.
   */
  function clearShot() {
    fileRef.current = null;
    sourceRef.current = null;
    originalHostRef.current?.replaceChildren();
    setDetection(null);
    setFileInfo(null);
    setMessage(null);
    setMode("idle");
  }

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    // Forget it immediately, so choosing the *same* file again still fires a
    // change event. Otherwise a photo that fails detection can never be
    // re-tried without picking something else first, and the button looks
    // dead on the one press most likely to be a deliberate retry.
    event.target.value = "";

    setMode("detecting");
    setMessage(null);
    setDetection(null);
    fileRef.current = file;
    setFileInfo(
      `${file.type || "unknown type"} · ${Math.round(file.size / 1024)}kB`,
    );

    // Everything below can throw: decoding, canvas allocation, detection.
    // Without this the handler rejects into nowhere and the button looks
    // broken, which is worse than any error it could have shown.
    try {
      const canvas = await fileToCanvas(file);
      sourceRef.current = canvas;
      showOriginal(canvas);
      setFileInfo(
        `${file.type || "unknown type"} · ${Math.round(file.size / 1024)}kB · ` +
          `${canvas.width}×${canvas.height}`,
      );

      // Yield once so the frame paints before the detector blocks the thread.
      await new Promise((r) => setTimeout(r, 0));

      const result = detectSheet(canvas);
      if (isDetectionFailure(result)) {
        setMode("failed");
        setMessage(
          `${result.reason}${
            result.markerIds.length > 0
              ? ` (saw IDs ${result.markerIds.join(", ")})`
              : ""
          }`,
        );
        return;
      }

      setDetection(result);
      setMode("found");
    } catch (error) {
      setMode("failed");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function onSave() {
    const file = fileRef.current;
    if (!file || !detection) return;

    setMode("saving");
    const form = new FormData();
    form.set("image", file);
    form.set(
      "calibration",
      JSON.stringify({
        m: detection.homography,
        pxPerMm: detection.pxPerMm,
        // The version markers are no longer printed, so this normally comes
        // from configuration; a rig that does carry them still wins.
        sheetVersion: detection.sheetVersion ?? SHEET_VERSION,
        greyPatchRgb: detection.greyPatchRgb,
        // The marker quad bounds the garment; the cutout needs it to know
        // which surface is background.
        cornersInImage: detection.cornersInImage,
        source: "sheet",
      }),
    );

    let response: Response;
    if (garmentId) {
      form.set("view", shooting);
      response = await fetch(`/api/garments/${garmentId}/photos`, {
        method: "POST",
        body: form,
      });
    } else if (draft.category) {
      form.set("category", draft.category);
      form.set("brand", draft.brand);
      form.set("name", draft.name);
      if (draft.colour) form.set("colour", draft.colour);
      response = await fetch("/api/garments", { method: "POST", body: form });
    } else {
      // The details step will not advance without one, so this is a guard
      // rather than a path anyone reaches.
      setMode("found");
      setMessage("Pick a type before saving.");
      return;
    }

    if (!response.ok) {
      setMode("found");
      setMessage("Could not save. Check the server log.");
      return;
    }

    const { garmentId: id } = (await response.json()) as { garmentId: string };

    // The front creates the garment; the back is the same flow one step on.
    // Both faces are required before measuring, so there is no way past here
    // that skips it: the measure screen sends you back if one is missing.
    if (!singleView && shooting === "front") {
      setGarmentId(id);
      clearShot();
      setShooting("back");
      window.scrollTo({ top: 0 });
      return;
    }

    // A new garment goes on to its close-ups, then measuring, then the
    // closet. Re-shooting a single view returns to the item you came from.
    if (!singleView) {
      clearShot();
      setStage("closeups");
      window.scrollTo({ top: 0 });
      return;
    }
    // Reshooting the face an unfinished capture was missing completes it;
    // with a face still missing this does nothing and the item page sends
    // you back for it.
    if (shooting !== "detail") {
      const { added } = await finishCapture(id).catch(() => ({ added: false }));
      if (added) toast({ message: "Added to closet", href: `/item/${id}` });
    }
    router.push(`/item/${id}`);
  }

  /**
   * Both faces are in, so the garment goes in the closet now. Its cutouts
   * started when each face was uploaded and carry on in the background;
   * measuring is prompted for from the closet, or done right away.
   */
  async function onCloseupsDone(measureNow: boolean) {
    if (!garmentId) return;
    if (singleView) {
      router.push(`/item/${garmentId}`);
      return;
    }
    try {
      await finishCapture(garmentId);
    } catch {
      setMessage("Could not add. Check the server log.");
      return;
    }
    const label = [draft.brand, draft.name].filter(Boolean).join(" ");
    if (measureNow) {
      router.push(`/measure/${garmentId}?next=closet`);
      return;
    }
    toast({
      message: "Added to closet",
      detail: label ? `${label} · cutting out, measure later` : undefined,
      href: `/item/${garmentId}`,
    });
    router.push("/");
  }

  // The two diagonals have to agree. If they do not, one of the six numbers
  // in the environment is wrong, and every measurement inherits it silently.
  const rigResidual = quadCheckMm();

  // Trousers lay out differently from a shirt, so the guide follows the
  // category instead of always drawing a top.
  const captureSilhouette = draft.category
    ? silhouetteFor(draft.category)
    : null;

  const detailsComplete =
    draft.category !== null &&
    draft.colour !== "" &&
    draft.brand.trim() !== "" &&
    draft.name.trim() !== "";

  const viewWord = VIEW_LABELS[shooting].toLowerCase();

  /** The line under the picture: what is happening, or why it stopped. */
  function detectionNote(): string | null {
    switch (mode) {
      case "detecting":
        return "Detecting markers…";
      case "failed":
        return message ?? "Markers not found.";
      default:
        if (!detection) return null;
        return `${detection.markerIds.length} markers · ${detection.pxPerMm} px/mm`;
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      {rigResidual !== null && rigResidual > RIG_TOLERANCE_MM ? (
        <p className="text-fg mb-6 text-12">
          Rig check: the two diagonals disagree by {rigResidual.toFixed(0)}
          &nbsp;mm. One of the six span numbers is wrong. Re-measure before
          shooting.
        </p>
      ) : null}

      {clientError ? (
        <p className="text-fg mb-4 max-w-lg text-12">
          Script error: {clientError}
        </p>
      ) : null}

      {stage === "details" ? (
        <>
          <GarmentForm
            draft={draft}
            onChange={setDraft}
            brands={brands}
            footer={
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setStage("shoot")}
                  disabled={!detailsComplete}
                >
                  Next
                </button>
              </div>
            }
          />
        </>
      ) : stage === "closeups" && garmentId ? (
        <DetailShots
          garmentId={garmentId}
          doneLabel={singleView ? "Done" : "Add to closet"}
          onDone={() => onCloseupsDone(false)}
          secondary={
            singleView
              ? undefined
              : { label: "Measure now", onClick: () => onCloseupsDone(true) }
          }
        />
      ) : (
        <>
          {/* The shape to lay out and the one rule that matters. Everything
              else the rig needs is on the printed pages. */}
          <div className="mb-6 flex items-center gap-5">
            {captureSilhouette ? (
              <GarmentOutline
                silhouette={captureSilhouette}
                category={draft.category}
                size={56}
              />
            ) : null}
            <div>
              <p className="label">{VIEW_LABELS[shooting]}</p>
              <p className="text-fg2 mt-1 text-12">
                Flat, inside the four markers, shot straight down.
              </p>
              {!singleView && draft.brand ? (
                <p className="data text-fg3 mt-1">
                  {draft.brand} · {draft.name}
                </p>
              ) : null}
            </div>
          </div>

          {mode === "idle" ? (
            <label className="dropzone">
              <span aria-hidden className="dropzone-plus">
                +
              </span>
              <span className="sr-only">{`Choose or take the ${viewWord} photo`}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onPick}
              />
            </label>
          ) : (
            <>
              {/* One picture: the photograph while the markers are being
                  looked for, the flattened metric canvas once they are. */}
              <div className="mx-auto max-w-lg">
                <div
                  ref={originalHostRef}
                  className={detection ? "hidden" : ""}
                />
                <div ref={previewHostRef} />
              </div>

              <div className="mt-3 flex items-baseline justify-between gap-4">
                <p
                  className={`text-12 ${mode === "failed" ? "text-fg" : "data text-fg3"}`}
                >
                  {detectionNote()}
                </p>
                <label className="label link-text shrink-0 cursor-pointer">
                  Retake
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={onPick}
                  />
                </label>
              </div>

              {mode === "failed" && fileInfo ? (
                <p className="data text-fg3 mt-1">{fileInfo}</p>
              ) : null}
              {message && mode !== "failed" ? (
                <p className="text-fg mt-2 text-12">{message}</p>
              ) : null}
            </>
          )}

          {/* Only once the markers are found: before that there is nothing
              to advance to. */}
          {detection ? (
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                className="btn-primary"
                onClick={onSave}
                disabled={mode === "saving"}
              >
                {mode === "saving" ? "Saving…" : "Next"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
