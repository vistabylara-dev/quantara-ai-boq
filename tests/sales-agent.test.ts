import { describe, expect, it, vi } from "vitest";
import { adviseSales, salesChatSchema } from "../src/lib/sales-agent/advisor";
import { salesAIReady, salesPeriod, withinSalesLimits } from "../src/lib/sales-agent/policy";

const now = new Date("2026-09-09T12:00:00Z");
const env = { SALES_AGENT_ENABLED: "true", SALES_AGENT_OPENAI_API_KEY: "test-only", SALES_AGENT_IP_HASH_SECRET: "x".repeat(32) };
const input = salesChatSchema.parse({ requestId: "123e4567-e89b-42d3-a456-426614174000", message: "Can I pay for a plan?", locale: "en" });
function deps() { return { env, now, reserve: vi.fn().mockResolvedValue(true), finish: vi.fn().mockResolvedValue(undefined), fetchImpl: vi.fn() }; }

describe("owner-funded sales agent", () => {
  it("stops before exceeding the approved monthly and daily allowances", () => {
    expect(withinSalesLimits(4990, 29, 9)).toBe(true);
    expect(withinSalesLimits(5000, 0, 0)).toBe(false);
    expect(withinSalesLimits(0, 30, 0)).toBe(false);
    expect(withinSalesLimits(0, 0, 10)).toBe(false);
  });
  it("uses the UAE calendar at a month boundary", () => {
    expect(salesPeriod(new Date("2026-09-30T20:01:00Z"))).toEqual({ month: "2026-10", day: "2026-10-01" });
  });
  it("cannot use the customer BOQ key, and closes after pricing review expires", () => {
    expect(salesAIReady({ ...env, SALES_AGENT_OPENAI_API_KEY: "", OPENAI_API_KEY: "other-key" }, now)).toBe(false);
    expect(salesAIReady(env, new Date("2026-10-09T00:00:00Z"))).toBe(false);
  });
  it("makes no paid call if a reservation is denied or the database is unavailable", async () => {
    for (const unavailable of [false, true]) {
      const d = deps();
      if (unavailable) d.reserve.mockRejectedValue(new Error("Database down")); else d.reserve.mockResolvedValue(false);
      expect((await adviseSales(input, "ip", d)).href).toBe("/pricing");
      expect(d.fetchImpl).not.toHaveBeenCalled();
    }
  });
  it("retains failed reservations and never retries the provider", async () => {
    const d = deps(); d.fetchImpl.mockRejectedValue(new Error("timeout"));
    await adviseSales(input, "ip", d);
    expect(d.fetchImpl).toHaveBeenCalledTimes(1);
    expect(d.finish).toHaveBeenCalledWith(input.requestId, "FAILED");
  });
  it("renders only reviewed statements, never generated prices or external links", async () => {
    const d = deps();
    d.fetchImpl.mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ answer: "pricing", question: "next", price: 1, href: "https://evil.example" }) }] }] })));
    const answer = await adviseSales(input, "ip", d);
    expect(answer.mode).toBe("reviewed_answers");
    expect(answer.href).toBe("/pricing");
    expect(answer.message).not.toContain("evil");
  });
  it("bounds requests and selects valid Arabic advice without payment writes", async () => {
    const d = deps();
    d.fetchImpl.mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [{ content: [{ type: "output_text", text: '{"answer":"fitout","question":"source"}' }] }] })));
    const result = await adviseSales({ ...input, locale: "ar" }, "ip", d);
    expect(result.mode).toBe("ai_selected");
    expect(result.href).toBe("/ar/boq-software-for-fit-out-companies");
    const body = JSON.parse(d.fetchImpl.mock.calls[0][1].body);
    expect(body.max_output_tokens).toBe(300);
    expect(body.store).toBe(false);
    expect(body.tools).toBeUndefined();
    expect(d.reserve.mock.invocationCallOrder[0]).toBeLessThan(d.fetchImpl.mock.invocationCallOrder[0]);
  });
  it("rejects unbounded history and attempts to supply model instructions", () => {
    expect(salesChatSchema.safeParse({ ...input, history: Array(5).fill("x") }).success).toBe(false);
    expect(salesChatSchema.safeParse({ ...input, model: "expensive-model" }).success).toBe(false);
  });
});
