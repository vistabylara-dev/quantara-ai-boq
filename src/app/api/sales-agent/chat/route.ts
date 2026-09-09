import { createHmac } from "node:crypto";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { adviseSales, salesChatSchema } from "@/lib/sales-agent/advisor";
import { reserveSalesAttempt, finishSalesAttempt } from "@/lib/repositories/sales-agent-budget-repository";
import { getRequestIp } from "@/lib/security/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public capability is limited to reviewed sales guidance. No tenant reads,
// outbound communications, arbitrary tools or payment writes are available.
export async function POST(request: Request) {
  try {
    if (process.env.SALES_AGENT_ENABLED !== "true") throw new AppError("SALES_UNAVAILABLE", "Please contact sales directly.", 503);
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new AppError("INVALID_ORIGIN", "Invalid request origin.", 403);
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new AppError("INVALID_CONTENT_TYPE", "JSON required.", 415);
    const reader = request.body?.getReader();
    if (!reader) throw new AppError("INVALID_JSON", "A message is required.", 400);
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 16_000) { await reader.cancel(); throw new AppError("PAYLOAD_TOO_LARGE", "Please shorten your message.", 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let raw: unknown;
    try { raw = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new AppError("INVALID_JSON", "Invalid JSON.", 400); }
    const input = salesChatSchema.parse(raw);
    const secret = process.env.SALES_AGENT_IP_HASH_SECRET?.trim() ?? "disabled";
    const ipHash = createHmac("sha256", secret).update(getRequestIp(request)).digest("hex");
    const result = await adviseSales(input, ipHash, {
      env: process.env, reserve: reserveSalesAttempt, finish: finishSalesAttempt,
    });
    return apiSuccess(result);
  } catch (error) { return handleApiError(error); }
}
