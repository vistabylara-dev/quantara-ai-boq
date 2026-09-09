/** Dedicated sales pilot: never reuse TAYQAN credentials or provider settings. */
export const SALES_MODEL = "gpt-4.1-mini-2025-04-14";
export const MONTHLY_RESERVE_FILS = 5_000;
export const REQUEST_RESERVE_FILS = 10;
export const DAILY_REQUEST_LIMIT = 30;
export const IP_DAILY_REQUEST_LIMIT = 10;
export const MAX_INPUT_BYTES = 12_000;
export const MAX_OUTPUT_TOKENS = 300;
// Recheck provider pricing before extending this date. Closed after expiry.
export const PRICING_REVIEW_EXPIRES = "2026-10-09T00:00:00Z";

export function salesPeriod(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  return { day, month: day.slice(0, 7) };
}

export function salesAIReady(env: Record<string, string | undefined> = process.env, now = new Date()) {
  return env.SALES_AGENT_ENABLED === "true"
    && Boolean(env.SALES_AGENT_OPENAI_API_KEY?.trim())
    && Boolean(env.SALES_AGENT_IP_HASH_SECRET?.trim().length && env.SALES_AGENT_IP_HASH_SECRET.trim().length >= 32)
    && now.getTime() < Date.parse(PRICING_REVIEW_EXPIRES);
}

/** A conservative reservation, not the provider's invoice. All attempted calls
 * retain their full reservation, including timeouts, failures and crashes.
 * Pricing checked 2026-09-09: $0.40 input / $1.60 output per million tokens.
 * Even 12,000 input tokens plus 300 output tokens cost <$0.006; 10 fils
 * leaves substantial exchange/tax/overhead headroom. No tools or retries.
 */
export function withinSalesLimits(monthFils: number, dayCalls: number, ipCalls: number) {
  return monthFils + REQUEST_RESERVE_FILS <= MONTHLY_RESERVE_FILS
    && dayCalls < DAILY_REQUEST_LIMIT && ipCalls < IP_DAILY_REQUEST_LIMIT;
}
