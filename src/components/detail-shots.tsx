"use client";

import { useEffect, useRef, useState } from "react";

import { deleteDetailPhoto } from "@/app/actions";
import { useActivity } from "@/components/activity";
import {
  DETAIL_KIND_LABELS,
  DETAIL_KINDS,
  type DetailKind,
} from "@/lib/measure/templates";

type Shot = {
  id: string;
  kind: DetailKind;
  /** An object URL of the file as picked; the upload is not read back. */
  src: string;
};

/**
 * Close-ups, after the two faces and before the pins. Optional, and as many
 * as the garment has worth reading.
 *
 * No markers and no detection: a care label shot close enough to read is far
 * too close for the rig to be in frame, and nothing here is measured. The
 * kind is picked first so that taking the photo is the last tap, and each
 * shot uploads the moment it is taken; there is nothing to confirm.
 */
export function DetailShots({
  garmentId,
  doneLabel,
  onDone,
  secondary,
}: {
  garmentId: string;
  doneLabel: string;
  onDone: () => void;
  /** A second way out beside the filled button, e.g. "Measure now". */
  secondary?: { label: string; onClick: () => void };
}) {
  const { toast } = useActivity();
  const [kind, setKind] = useState<DetailKind>("label");
  const [shots, setShots] = useState<Shot[]>([]);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Object URLs pin the whole file in memory until revoked.
  const urls = useRef<string[]>([]);
  useEffect(() => {
    const held = urls.current;
    return () => held.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setNote(null);
    const form = new FormData();
    form.set("image", file);
    form.set("view", "detail");
    form.set("detailKind", kind);
    try {
      const response = await fetch(`/api/garments/${garmentId}/photos`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) throw new Error(String(response.status));
      const { photoId } = (await response.json()) as { photoId: string };
      const src = URL.createObjectURL(file);
      urls.current.push(src);
      setShots((current) => [...current, { id: photoId, kind, src }]);
      toast({ message: "Detail added", detail: DETAIL_KIND_LABELS[kind] });
    } catch {
      setNote("Could not save. Check the server log.");
    } finally {
      setUploading(false);
    }
  }

  async function onRemove(id: string) {
    setNote(null);
    try {
      await deleteDetailPhoto(id);
      setShots((current) => current.filter((s) => s.id !== id));
      toast({ message: "Detail removed" });
    } catch {
      setNote("Could not remove. Check the server log.");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="label">Details</p>
        <p className="text-fg2 mt-1 text-12">
          Optional. Close enough to read: the care label, the weave, a print.
          No markers needed.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
        {DETAIL_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className="label tab"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >
            {DETAIL_KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <label
        className="dropzone"
        aria-disabled={uploading}
        style={uploading ? { pointerEvents: "none" } : undefined}
      >
        {uploading ? (
          <span className="data">Saving…</span>
        ) : (
          <span aria-hidden className="dropzone-plus">
            +
          </span>
        )}
        <span className="sr-only">{`Take a ${DETAIL_KIND_LABELS[kind].toLowerCase()} photo`}</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onPick}
          disabled={uploading}
        />
      </label>

      {note ? <p className="text-fg mt-2 text-12">{note}</p> : null}

      {shots.length > 0 ? (
        <ul className="rule-top mx-auto mt-6 grid max-w-lg grid-cols-3 gap-3 pt-3">
          {shots.map((shot) => (
            <li key={shot.id}>
              {/* Plain <img> on purpose. See eslint.config.mjs. */}
              <img
                src={shot.src}
                alt={DETAIL_KIND_LABELS[shot.kind]}
                className="block aspect-square w-full object-cover"
              />
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="data text-fg3">
                  {DETAIL_KIND_LABELS[shot.kind]}
                </span>
                <button
                  type="button"
                  className="link-text text-11"
                  onClick={() => onRemove(shot.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        className={
          secondary ? "action-row mt-10" : "mt-10 flex justify-center"
        }
      >
        <button
          type="button"
          className="btn-primary flex-1 py-4"
          onClick={onDone}
          disabled={uploading}
        >
          {doneLabel}
        </button>
        {secondary ? (
          <button
            type="button"
            className="label link-text"
            onClick={secondary.onClick}
            disabled={uploading}
          >
            {secondary.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
