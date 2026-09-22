/**
 * js-aruco2 interop.
 *
 * The library is a pair of plain browser scripts that publish themselves by
 * assigning to `this` at module top level (`this.AR = AR`). Node's CommonJS
 * loader makes that work because it calls the module with `this === exports`,
 * but a bundler analysing the file statically sees no exports at all. So the
 * whole module object is imported and the namespace picked off at runtime.
 */
import type { Detector as DetectorType, Dictionary as DictionaryType } from "js-aruco2";

import * as arucoNamespace from "js-aruco2";

type ArucoNamespace = {
  AR?: { Dictionary: typeof DictionaryType; Detector: typeof DetectorType };
  default?: {
    AR?: { Dictionary: typeof DictionaryType; Detector: typeof DetectorType };
  };
};

const namespace = arucoNamespace as unknown as ArucoNamespace;
const resolved = namespace.AR ?? namespace.default?.AR;

if (!resolved) {
  throw new Error(
    "js-aruco2 did not expose AR — its CommonJS `this` export did not survive bundling",
  );
}

export const AR = resolved;
