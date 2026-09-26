"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { deleteGarment, finishCapture } from "@/app/actions";
import { useActivity } from "@/components/activity";
import { CATEGORY_LABELS, type Category } from "@/lib/measure/templates";

export type UnfinishedCapture = {
  id: string;
  shortId: number;
  category: Category;
  brand: string | null;
  name: string | null;
  /** The faces already shot, so the row can name what is missing. */
  views: string[];
};

/**
 * Captures that were started and never added: a face is missing.
 *
 * They cannot simply be hidden. A garment row exists from the first
 * photograph (the cutout job needs a file and a row to write back to) so
 * filtering them out of the grid without listing them anywhere would leave
 * real rows and real files on disk that no screen could reach and nothing
 * could delete. Listed here they are one tap from being finished and one
 * from being gone.
 */
export function UnfinishedCaptures({ items }: { items: UnfinishedCapture[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rule-top mt-20 pt-3">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="label text-fg2">Unfinished</p>
        <p className="label text-fg3">
          {items.length} CAPTURE{items.length === 1 ? "" : "S"}
        </p>
      </div>
      <p className="text-fg2 mb-4 max-w-lg text-11">
        Started but missing a photo, so they are not in the closet yet. Shoot
        the missing face or throw the capture away.
      </p>

      <ul>
        {items.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

/** What still has to happen before this is a garment. */
function missing(views: string[]): string {
  const absent = ["front", "back"].filter((v) => !views.includes(v));
  if (absent.length === 0) return "both photos, never added";
  return `no ${absent.join(" or ")} photo`;
}

function Row({ item }: { item: UnfinishedCapture }) {
  const router = useRouter();
  const { toast } = useActivity();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const complete = ["front", "back"].every((v) => item.views.includes(v));

  // Both faces are in and the capture was left before Add was pressed.
  async function onAdd() {
    setPending(true);
    try {
      await finishCapture(item.id);
      toast({ message: "Added to closet", href: `/item/${item.id}` });
      router.refresh();
    } catch {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setPending(true);
    try {
      await deleteGarment(item.id);
      toast({
        message: "Capture discarded",
        detail: [item.brand, item.name].filter(Boolean).join(" ") || undefined,
      });
      router.refresh();
    } catch {
      setPending(false);
      setConfirming(false);
    }
  }

  return (
    <li className="rule-top flex gap-4 py-3">
      <span className="data text-fg3 w-7 shrink-0 pt-px">
        {String(item.shortId).padStart(3, "0")}
      </span>

      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
        <div className="min-w-0 sm:flex-1">
          <p className="label">{item.brand ?? "Unbranded"}</p>
          <p className="text-fg2 mt-0.5 text-11">
            {item.name ?? CATEGORY_LABELS[item.category]} ·{" "}
            {missing(item.views)}
          </p>
        </div>

        <div className="mt-3 flex gap-2 sm:mt-0 sm:shrink-0">
          {complete ? (
            <button
              type="button"
              className="chip"
              onClick={onAdd}
              disabled={pending}
            >
              Add
            </button>
          ) : (
            // The measure route sends a capture back for its missing face.
            <Link href={`/measure/${item.id}`} className="chip">
              Finish
            </Link>
          )}
          <button
            type="button"
            className="chip chip-danger"
            onClick={onDelete}
            disabled={pending}
          >
            {confirming ? "Tap again to delete" : "Delete"}
          </button>
        </div>
      </div>
    </li>
  );
}
