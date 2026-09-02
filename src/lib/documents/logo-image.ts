const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 5000;

export type LogoImageFormat = "png" | "jpeg" | "gif";

export type LoadedLogoImage = {
  buffer: Buffer;
  format: LogoImageFormat;
  width: number;
  height: number;
};

const CONTENT_TYPE_FORMAT: Record<string, LogoImageFormat> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/gif": "gif",
};

function getPngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (!isPng) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (!width || !height) return null;
  return { width, height };
}

function getGifDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 10) return null;
  const header = buf.toString("ascii", 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") return null;
  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  if (!width || !height) return null;
  return { width, height };
}

function getJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 <= buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const segmentLength = buf.readUInt16BE(offset + 2);
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      if (offset + 9 > buf.length) return null;
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      if (!width || !height) return null;
      return { width, height };
    }
    if (segmentLength < 2) return null;
    offset += 2 + segmentLength;
  }
  return null;
}

function getImageDimensions(buf: Buffer, format: LogoImageFormat): { width: number; height: number } | null {
  if (format === "png") return getPngDimensions(buf);
  if (format === "gif") return getGifDimensions(buf);
  return getJpegDimensions(buf);
}

/**
 * Fetches and validates a company logo for embedding in a generated document.
 * Never throws and never rejects — a missing, invalid, unreachable, oversized,
 * or corrupt logo must never block BOQ/proposal generation, so every failure
 * path (bad URL, non-image content-type, timeout, oversized body, unparsable
 * image bytes) resolves to null instead of a document without a logo.
 */
export async function loadLogoImage(logoUrl: string | null | undefined): Promise<LoadedLogoImage | null> {
  if (!logoUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(logoUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(parsed.toString(), { signal: controller.signal, redirect: "follow" });
    if (!response.ok || !response.body) return null;

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const format = CONTENT_TYPE_FORMAT[contentType];
    if (!format) return null;

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_LOGO_BYTES) return null;

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > MAX_LOGO_BYTES) return null;

    const buffer = Buffer.from(arrayBuffer);
    const dimensions = getImageDimensions(buffer, format);
    if (!dimensions) return null;

    return { buffer, format, width: dimensions.width, height: dimensions.height };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Scales width/height to fit within a bounding box while preserving aspect ratio. */
export function fitLogoBox(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: maxWidth, height: maxHeight };
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
