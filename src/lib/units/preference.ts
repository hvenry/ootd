"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { DisplayUnit } from "@/lib/units";

/**
 * The display unit is a site-wide preference, kept in localStorage until
 * there is an account to hang it on. Every reader subscribes to the same
 * key, so cycling it on one screen changes every number on every screen.
 */
const KEY = "unit";
const ORDER: readonly DisplayUnit[] = ["mm", "cm", "in"];
const listeners = new Set<() => void>();

function read(): DisplayUnit {
  try {
    const v = localStorage.getItem(KEY);
    return v === "cm" || v === "in" ? v : "mm";
  } catch {
    return "mm";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Another tab changing it should update this one too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useDisplayUnit(): [DisplayUnit, () => void] {
  const unit = useSyncExternalStore(subscribe, read, () => "mm" as DisplayUnit);
  const cycle = useCallback(() => {
    const next = ORDER[(ORDER.indexOf(read()) + 1) % ORDER.length];
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode: the change lasts for this page view only.
    }
    listeners.forEach((l) => l());
  }, []);
  return [unit, cycle];
}
