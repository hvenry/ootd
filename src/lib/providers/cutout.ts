/**
 * The cutout provider the worker runs, from the environment the two share.
 * The app only needs it to name a queued job's provider before the worker
 * has recorded one, and the labels to show it.
 */
export const CUTOUT_PROVIDER_NAMES = ["chroma", "local", "replicate"] as const;
export type CutoutProviderName = (typeof CUTOUT_PROVIDER_NAMES)[number];

export const CUTOUT_PROVIDER_LABELS: Record<CutoutProviderName, string> = {
  chroma: "Colour key",
  local: "BiRefNet",
  replicate: "Replicate",
};

export function defaultCutoutProvider(): CutoutProviderName {
  const chosen = (process.env.CUTOUT_PROVIDER ?? "local").trim().toLowerCase();
  return (CUTOUT_PROVIDER_NAMES as readonly string[]).includes(chosen)
    ? (chosen as CutoutProviderName)
    : "local";
}
