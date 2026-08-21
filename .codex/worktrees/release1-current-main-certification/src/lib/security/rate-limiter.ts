import { AppError } from "@/lib/errors/app-error";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export type RateLimiter = {
  consume(key: string): RateLimitResult;
};

/**
 * Fixed-window in-memory limiter. Explicitly a dev/single-instance
 * abstraction (per spec section 31): acceptable for local development and
 * a single Node process, but state is process-local and resets on
 * restart/redeploy. A production deployment with multiple instances needs
 * a shared store (Redis, etc.) behind this same `RateLimiter` interface —
 * swapping the implementation requires no caller changes.
 */
export function createInMemoryRateLimiter(options: { max: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, { count: number; windowStart: number }>();

  return {
    consume(key: string): RateLimitResult {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || now - entry.windowStart >= options.windowMs) {
        hits.set(key, { count: 1, windowStart: now });
        return { allowed: true, remaining: options.max - 1, retryAfterMs: 0 };
      }
      entry.count += 1;
      const allowed = entry.count <= options.max;
      const retryAfterMs = Math.max(0, options.windowMs - (now - entry.windowStart));
      return { allowed, remaining: Math.max(0, options.max - entry.count), retryAfterMs };
    },
  };
}

// Named limiters for each public-portal action that needs one (spec section 31).
export const passcodeAttemptLimiter = createInMemoryRateLimiter({ max: 5, windowMs: 5 * 60 * 1000 });
export const commentLimiter = createInMemoryRateLimiter({ max: 10, windowMs: 10 * 60 * 1000 });
export const approvalLimiter = createInMemoryRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });
export const revisionRequestLimiter = createInMemoryRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });
export const rejectionLimiter = createInMemoryRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });
export const documentDownloadLimiter = createInMemoryRateLimiter({ max: 30, windowMs: 5 * 60 * 1000 });

export function assertNotRateLimited(limiter: RateLimiter, key: string): void {
  const result = limiter.consume(key);
  if (!result.allowed) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many attempts. Please wait a moment and try again.",
      429,
      { retryAfterMs: [String(result.retryAfterMs)] },
    );
  }
}
