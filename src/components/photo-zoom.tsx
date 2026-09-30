"use client";

import { useEffect, useRef } from "react";

export type ZoomPhoto = {
  id: string;
  src: string;
  /** Shown if `src` fails to load. */
  fallback: string;
  alt: string;
};

/**
 * The garment on its own, filling the screen: each face as wide as the
 * screen, so it is larger than the page could show it, front first and then
 * the back below it. Scrolling runs down the garment and on to the back.
 * Plain white behind, nothing else on screen. It appears at once, with no
 * fade: a click on a photo should feel like looking closer, not like a
 * dialog opening.
 *
 * A click anywhere, or Escape, goes back, and reports which face was in
 * view so the page can come back showing the same one.
 */
export function PhotoZoom({
  photos,
  start,
  onClose,
}: {
  photos: ZoomPhoto[];
  /** The photo to open on, an index into `photos`. */
  start: number;
  onClose: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const images = useRef<(HTMLImageElement | null)[]>([]);
  // Set once the person scrolls, after which nothing moves them.
  const moved = useRef(false);

  // Opens on the face that was showing, not always the front. The faces
  // have no height until they load, so this is repeated as each one does,
  // until somebody scrolls.
  const settle = () => {
    const el = ref.current;
    const image = images.current[start];
    if (!moved.current && el && image) el.scrollTop = image.offsetTop;
  };

  /** The face under the middle of the screen. */
  const inView = () => {
    const el = ref.current;
    if (!el) return start;
    const middle = el.scrollTop + el.clientHeight / 2;
    let best = start;
    let distance = Infinity;
    images.current.forEach((image, i) => {
      if (!image) return;
      const d = Math.abs(image.offsetTop + image.offsetHeight / 2 - middle);
      if (d < distance) {
        distance = d;
        best = i;
      }
    });
    return best;
  };

  // The page behind stays put while this one scrolls.
  useEffect(() => {
    settle();
    ref.current?.focus();
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
    // Once, on open: `settle` reads refs and is re-run by each image load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => onClose(inView());

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Photos, full screen. Click or press Escape to close."
      tabIndex={-1}
      onClick={close}
      onWheel={() => {
        moved.current = true;
      }}
      onTouchMove={() => {
        moved.current = true;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
        else moved.current = true;
      }}
      className="bg-bg fixed inset-0 z-50 cursor-zoom-out overflow-y-auto overscroll-contain outline-none"
    >
      {photos.map((p, i) => (
        // Plain <img> on purpose. See eslint.config.mjs.
        <img
          key={p.id}
          ref={(image) => {
            images.current[i] = image;
          }}
          src={p.src}
          alt={p.alt}
          draggable={false}
          onLoad={settle}
          onError={(event) => {
            const img = event.currentTarget;
            if (!img.src.endsWith(p.fallback)) img.src = p.fallback;
          }}
          className="block h-auto w-full"
        />
      ))}
    </div>
  );
}
