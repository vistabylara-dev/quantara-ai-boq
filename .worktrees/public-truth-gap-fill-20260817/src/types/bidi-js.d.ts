declare module "bidi-js" {
  export type BidiEmbeddingLevels = {
    levels: Uint8Array;
    paragraphs: Array<{ start: number; end: number; level: number }>;
  };

  export type BidiEngine = {
    getEmbeddingLevels(text: string, baseDirection?: "ltr" | "rtl" | "auto"): BidiEmbeddingLevels;
    getReorderedString(text: string, embeddingLevels: BidiEmbeddingLevels): string;
    getReorderedIndices(text: string, embeddingLevels: BidiEmbeddingLevels): number[];
    getReorderSegments(text: string, embeddingLevels: BidiEmbeddingLevels): Array<[number, number]>;
  };

  export default function bidiFactory(): BidiEngine;
}
