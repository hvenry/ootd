declare module "js-aruco2" {
  export interface ArucoPoint {
    x: number;
    y: number;
  }

  export interface ArucoMarker {
    id: number;
    corners: ArucoPoint[];
    hammingDistance: number;
  }

  export class Dictionary {
    constructor(dictionaryName: string);
    codeList: string[][];
    markSize: number;
    tau: number;
    nBits: number;
    /** Square SVG for one marker, viewBox 0 0 (markSize+2) (markSize+2). */
    generateSVG(id: number): string;
  }

  export class Detector {
    constructor(config?: {
      dictionaryName?: string;
      maxHammingDistance?: number;
    });
    dictionary: Dictionary;
    detectImage(
      width: number,
      height: number,
      data: Uint8ClampedArray,
    ): ArucoMarker[];
  }

  export const AR: {
    Dictionary: typeof Dictionary;
    Detector: typeof Detector;
  };
}
