import { lookup } from "node:dns/promises";
import { request as httpRequest, type IncomingMessage, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

const MAX_LOGO_BYTES = 1024 * 1024;
const MAX_LOGO_DIMENSION = 4096;
const MAX_LOGO_PIXELS = 16_777_216;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 5000;
const MAX_RESPONSE_HEADER_BYTES = 16 * 1024;

export type LogoImageFormat = "png" | "jpeg";

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
};

const FORMAT_MIME_TYPE: Record<LogoImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
};

const BLOCKED_HOST_SUFFIXES = [
  "localhost",
  "local",
  "localdomain",
  "internal",
  "lan",
  "home",
  "home.arpa",
  "invalid",
  "test",
  "example",
  "onion",
];

type ResolvedTarget = { address: string; family: 4 | 6 };

function normalizeHostname(hostname: string): string {
  const withoutBrackets = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  return withoutBrackets.replace(/\.$/, "").toLowerCase();
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return octets;
}

function isPublicIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) return false;
  const [a, b, c] = octets;

  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false;
  return true;
}

function parseIpv6(address: string): number[] | null {
  if (address.includes("%")) return null;

  let normalized = address.toLowerCase();
  const ipv4TailMatch = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4TailMatch) {
    const octets = parseIpv4(ipv4TailMatch[1]);
    if (!octets) return null;
    const replacement = `${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
    normalized = normalized.slice(0, -ipv4TailMatch[1].length) + replacement;
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (halves.length === 1 && left.length !== 8) return null;
  if (halves.length === 2 && left.length + right.length >= 8) return null;

  const zeroCount = halves.length === 2 ? 8 - left.length - right.length : 0;
  const groups = [...left, ...Array.from({ length: zeroCount }, () => "0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;

  const bytes: number[] = [];
  for (const group of groups) {
    const value = Number.parseInt(group, 16);
    bytes.push(value >> 8, value & 0xff);
  }
  return bytes;
}

function isPublicIpv6(address: string): boolean {
  const bytes = parseIpv6(address);
  if (!bytes) return false;

  // Only globally routable unicast space is allowed. This excludes loopback,
  // unspecified, ULA, link-local, multicast, IPv4-mapped and translation ranges.
  if ((bytes[0] & 0xe0) !== 0x20) return false;

  // IETF protocol assignments, benchmarking, documentation, ORCHID and 6to4
  // ranges are not valid public logo origins even though they sit in 2000::/3.
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] <= 0x01) return false; // 2001:0000::/23
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x02 && bytes[4] === 0x00 && bytes[5] === 0x00) return false; // 2001:2::/48
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x00 && ((bytes[3] & 0xf0) === 0x10 || (bytes[3] & 0xf0) === 0x20)) return false;
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return false;
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return false;
  if (bytes[0] === 0x3f && bytes[1] === 0xff) return false;
  return true;
}

export function isPublicLogoAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  return BLOCKED_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

function validateLogoUrl(value: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.port && !((parsed.protocol === "http:" && parsed.port === "80") || (parsed.protocol === "https:" && parsed.port === "443"))) {
    return null;
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname || isBlockedHostname(hostname)) return null;
  const literalFamily = isIP(hostname);
  if (literalFamily !== 0 && !isPublicLogoAddress(hostname)) return null;
  return parsed;
}

function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error("Logo fetch timed out."));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error("Logo fetch timed out."));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function resolvePublicTarget(url: URL, signal: AbortSignal): Promise<ResolvedTarget | null> {
  const hostname = normalizeHostname(url.hostname);
  const literalFamily = isIP(hostname);
  if (literalFamily === 4 || literalFamily === 6) {
    return isPublicLogoAddress(hostname) ? { address: hostname, family: literalFamily } : null;
  }

  const records = await withAbort(lookup(hostname, { all: true, verbatim: true }), signal);
  if (records.length === 0) return null;

  const resolved: ResolvedTarget[] = [];
  for (const record of records) {
    if ((record.family !== 4 && record.family !== 6) || !isPublicLogoAddress(record.address)) return null;
    resolved.push({ address: record.address, family: record.family });
  }
  return resolved[0] ?? null;
}

function openPinnedResponse(url: URL, target: ResolvedTarget, signal: AbortSignal): Promise<IncomingMessage> {
  const options: RequestOptions & { servername?: string } = {
    protocol: url.protocol,
    hostname: target.address,
    family: target.family,
    port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
    path: `${url.pathname}${url.search}` || "/",
    method: "GET",
    headers: {
      Host: url.host,
      Accept: "image/png,image/jpeg",
      "Accept-Encoding": "identity",
      "User-Agent": "Quantara-Document-Logo/1.0",
    },
    signal,
    agent: false,
    maxHeaderSize: MAX_RESPONSE_HEADER_BYTES,
  };
  if (url.protocol === "https:") options.servername = normalizeHostname(url.hostname);

  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise<IncomingMessage>((resolve, reject) => {
    const outbound = request(options, resolve);
    outbound.once("error", reject);
    outbound.end();
  });
}

function firstHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function getPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((byte, index) => buffer[index] === byte)) return null;
  if (buffer.readUInt32BE(8) !== 13 || buffer.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width && height ? { width, height } : null;
}

function getJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (offset + 4 > buffer.length) return null;
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) return null;
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      if (segmentLength < 7 || offset + 9 > buffer.length) return null;
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return width && height ? { width, height } : null;
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function inspectImage(buffer: Buffer): Pick<LoadedLogoImage, "format" | "width" | "height"> | null {
  const candidates: Array<[LogoImageFormat, { width: number; height: number } | null]> = [
    ["png", getPngDimensions(buffer)],
    ["jpeg", getJpegDimensions(buffer)],
  ];
  const match = candidates.find(([, dimensions]) => dimensions !== null);
  if (!match || !match[1]) return null;
  const [format, dimensions] = match;
  if (dimensions.width > MAX_LOGO_DIMENSION || dimensions.height > MAX_LOGO_DIMENSION) return null;
  if (dimensions.width * dimensions.height > MAX_LOGO_PIXELS) return null;
  return { format, ...dimensions };
}

async function readBoundedImage(response: IncomingMessage): Promise<LoadedLogoImage | null> {
  const contentEncoding = firstHeader(response.headers["content-encoding"]);
  if (contentEncoding && contentEncoding.toLowerCase() !== "identity") {
    response.destroy();
    return null;
  }

  const contentType = (firstHeader(response.headers["content-type"]) ?? "").split(";", 1)[0].trim().toLowerCase();
  const declaredFormat = CONTENT_TYPE_FORMAT[contentType];
  if (!declaredFormat) {
    response.destroy();
    return null;
  }

  const contentLength = firstHeader(response.headers["content-length"]);
  if (contentLength) {
    if (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_LOGO_BYTES) {
      response.destroy();
      return null;
    }
  }

  const chunks: Buffer[] = [];
  let byteLength = 0;
  for await (const rawChunk of response) {
    const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk as Uint8Array);
    byteLength += chunk.byteLength;
    if (byteLength > MAX_LOGO_BYTES) {
      response.destroy();
      return null;
    }
    chunks.push(chunk);
  }
  if (byteLength === 0) return null;

  const buffer = Buffer.concat(chunks, byteLength);
  const inspected = inspectImage(buffer);
  if (!inspected || inspected.format !== declaredFormat) return null;
  return { buffer, ...inspected };
}

/**
 * Fetches a company logo for document embedding without allowing the stored URL
 * to become an SSRF primitive. DNS is resolved and checked before each hop, the
 * validated address is pinned for the connection, redirects are followed
 * manually, and response time/headers/body/dimensions are bounded.
 *
 * Logo failures are deliberately non-fatal: document/proposal generation must
 * continue without the image when the URL is missing, unsafe or unavailable.
 */
export async function loadLogoImage(logoUrl: string | null | undefined): Promise<LoadedLogoImage | null> {
  if (!logoUrl) return null;

  let current = validateLogoUrl(logoUrl);
  if (!current) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      const target = await resolvePublicTarget(current, controller.signal);
      if (!target) return null;

      const response = await openPinnedResponse(current, target, controller.signal);
      const status = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = firstHeader(response.headers.location);
        response.destroy();
        if (!location || redirectCount === MAX_REDIRECTS) return null;

        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          return null;
        }
        if (current.protocol === "https:" && next.protocol !== "https:") return null;
        const validatedNext = validateLogoUrl(next.toString());
        if (!validatedNext) return null;
        current = validatedNext;
        continue;
      }

      if (status !== 200) {
        response.destroy();
        return null;
      }
      return await readBoundedImage(response);
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function logoImageToDataUri(image: LoadedLogoImage | null | undefined): string | null {
  if (!image) return null;
  return `data:${FORMAT_MIME_TYPE[image.format]};base64,${image.buffer.toString("base64")}`;
}

/** Scales width/height to fit within a bounding box while preserving aspect ratio. */
export function fitLogoBox(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: maxWidth, height: maxHeight };
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
