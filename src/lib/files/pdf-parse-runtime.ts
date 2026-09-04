export async function loadPdfParse() {
  if (process.env.STORAGE_PROVIDER === "vercel-blob") {
    const canvas = await import("@napi-rs/canvas");
    Object.assign(globalThis, {
      DOMMatrix: globalThis.DOMMatrix ?? canvas.DOMMatrix,
      ImageData: globalThis.ImageData ?? canvas.ImageData,
      Path2D: globalThis.Path2D ?? canvas.Path2D,
    });
  }
  return import("pdf-parse");
}
