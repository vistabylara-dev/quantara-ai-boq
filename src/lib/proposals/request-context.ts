import { createHash } from "node:crypto";

/** Truncated, salted-by-nothing SHA-256 — good enough to group repeat access for abuse detection, never reversible to the original address. */
export function hashClientIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/** Coarse browser/OS family only — never the full user-agent string (which can be near-unique/fingerprintable). */
export function summarizeUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const lower = userAgent.toLowerCase();

  let browser = "Unknown browser";
  if (lower.includes("edg/")) browser = "Edge";
  else if (lower.includes("chrome/")) browser = "Chrome";
  else if (lower.includes("firefox/")) browser = "Firefox";
  else if (lower.includes("safari/") && !lower.includes("chrome")) browser = "Safari";

  let os = "Unknown OS";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("mac os")) os = "macOS";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone") || lower.includes("ipad")) os = "iOS";
  else if (lower.includes("linux")) os = "Linux";

  return `${browser} on ${os}`;
}

export function extractClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

export type RequestSignals = { ipHash: string | null; userAgentSummary: string | null };

export function extractRequestSignals(request: Request): RequestSignals {
  return {
    ipHash: hashClientIp(extractClientIp(request)),
    userAgentSummary: summarizeUserAgent(request.headers.get("user-agent")),
  };
}
