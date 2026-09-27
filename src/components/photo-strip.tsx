"use client";

import { useRef, useState } from "react";

import type { TileCrop } from "@/lib/storage";

export type StripPhoto = {
  id: string;
  src: string;
  /** Shown if `src` fails to load. */
  fallback: string;
  alt: string;
  /** Show only this part of `src`, as large as the slide allows. */
  crop?: TileCrop | null;
};

/**
 * Photos side by side, one in view, moved by a horizontal drag or swipe.
 *
 * The swipe is ours, not the browser's. A native horizontal scroller needs
 * a wheel or trackpad on desktop, and on a phone it chains into the document
 * at its end, which is how a swipe used to scroll the page sideways. Pointer
 * events behave the same for a mouse and a finger. `touch-action: pan-y`
 * leaves vertical scrolling to the page and claims only the horizontal
 * gesture.
 *
 * A swipe inside a link must not also follow the link, so a drag that moved
 * far enough swallows the click that ends it.
 */
export function PhotoStrip({
  photos,
  index,
  onIndexChange,
  className = "",
  imgClassName = "",
}: {
  photos: StripPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  className?: string;
  imgClassName?: string;
}) {
  const [drag, setDrag] = useState<{ startX: number; dx: number } | null>(null);
  // The fallback is the full-frame cutout, which a tile's crop does not fit.
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const swiped = useRef(false);
  const last = photos.length - 1;
  const swipeable = photos.length > 1;

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!swipeable) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    swiped.current = false;
    setDrag({ startX: event.clientX, dx: 0 });
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    setDrag({ startX: drag.startX, dx: event.clientX - drag.startX });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const width = event.currentTarget.clientWidth || 1;
    // A fifth of the width, or a quick flick, commits to the next photo.
    if (Math.abs(drag.dx) > width * 0.2 || Math.abs(drag.dx) > 60) {
      onIndexChange(Math.min(last, Math.max(0, index + (drag.dx < 0 ? 1 : -1))));
      swiped.current = true;
    } else if (Math.abs(drag.dx) > 8) {
      swiped.current = true;
    }
    setDrag(null);
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      onClickCapture={(event) => {
        if (swiped.current) {
          event.preventDefault();
          event.stopPropagation();
          swiped.current = false;
        }
      }}
      className={`overflow-hidden [touch-action:pan-y] select-none ${className}`}
      style={{ cursor: swipeable ? (drag ? "grabbing" : "grab") : undefined }}
    >
      <div
        className="flex h-full"
        style={{
          transform: `translateX(calc(${-index * 100}% + ${drag?.dx ?? 0}px))`,
          transition: drag ? "none" : "transform var(--strip-duration) ease-out",
        }}
      >
        {photos.map((p) =>
          p.crop && !failed.has(p.id) ? (
            /* The slide is a size container, so the box can take whichever
               of its width or height runs out first at the crop's own
               aspect, the way object-contain would for a whole image. */
            <div
              key={p.id}
              className={`flex w-full shrink-0 items-center justify-center [container-type:size] ${imgClassName}`}
            >
              <div
                className="relative overflow-hidden"
                style={{
                  aspectRatio: `${p.crop.w * 3} / ${p.crop.h * 4}`,
                  width: `min(100cqw, calc(100cqh * ${(p.crop.w * 3) / (p.crop.h * 4)}))`,
                }}
              >
                {/* Plain <img> on purpose. See eslint.config.mjs. */}
                <img
                  src={p.src}
                  alt={p.alt}
                  draggable={false}
                  onError={() => setFailed((f) => new Set(f).add(p.id))}
                  className="absolute block h-auto max-w-none"
                  style={{
                    width: `${100 / p.crop.w}%`,
                    left: `${(-p.crop.x / p.crop.w) * 100}%`,
                    top: `${(-p.crop.y / p.crop.h) * 100}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            // Plain <img> on purpose. See eslint.config.mjs.
            <img
              key={p.id}
              src={failed.has(p.id) ? p.fallback : p.src}
              alt={p.alt}
              draggable={false}
              onError={(event) => {
                const img = event.currentTarget;
                if (!img.src.endsWith(p.fallback)) img.src = p.fallback;
              }}
              className={`block w-full shrink-0 object-contain ${imgClassName}`}
            />
          ),
        )}
      </div>
    </div>
  );
}
