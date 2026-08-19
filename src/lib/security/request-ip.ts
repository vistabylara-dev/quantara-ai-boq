/**
 * Pure extraction of the `x-forwarded-for` first-entry parsing already used
 * by src/app/api/contact/route.ts's `limiterKey` — shared here so the six
 * auth routes (and any future rate-limited route) don't each duplicate it.
 * Not a rewrite: same header, same first-entry-only parsing, same fallback.
 */
export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return forwarded || "anonymous";
}
