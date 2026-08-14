import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { loadWorkerRunnerSecret } from "@/lib/config/security-secrets";
import { UnauthorizedError } from "@/lib/errors/app-error";
import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { drainWorkerRuns } from "@/lib/services/worker-runner-service";

export const dynamic = "force-dynamic";

const drainSchema = z.object({
  limit: z.number().int().min(1).max(5).default(1),
  runnerId: z.string().trim().min(8).max(200).optional(),
}).strict();

function authenticatesRunner(request: Request): boolean {
  const authorization = request.headers.get("Authorization");
  const provided = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  const expectedDigest = createHash("sha256").update(loadWorkerRunnerSecret(), "utf8").digest();
  const providedDigest = createHash("sha256").update(provided, "utf8").digest();
  return Boolean(provided) && timingSafeEqual(expectedDigest, providedDigest);
}

export async function POST(request: Request) {
  try {
    if (!authenticatesRunner(request)) throw new UnauthorizedError("Worker runner authentication failed.");
    const input = await parseJsonBody(request, drainSchema);
    const runnerId = input.runnerId ?? `runner-${randomUUID()}`;
    return apiSuccess(await drainWorkerRuns({ runnerId, limit: input.limit }));
  } catch (error) {
    return handleApiError(error);
  }
}
