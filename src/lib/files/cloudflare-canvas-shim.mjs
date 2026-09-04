// @napi-rs/canvas is a Node native module and cannot be bundled into a
// Cloudflare Worker. PDF.js only uses these exports as web-platform
// polyfills; workerd supplies the corresponding globals when available.
export const DOMMatrix = globalThis.DOMMatrix;
export const ImageData = globalThis.ImageData;
export const Path2D = globalThis.Path2D;

export function createCanvas() {
  throw new Error("Canvas rasterization is unavailable in the Cloudflare Worker runtime.");
}
