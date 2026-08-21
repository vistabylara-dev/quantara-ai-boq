import { describe, expect, it } from "vitest";
import {
  loadWorkerAIPlannerConfig,
  loadWorkerRunnerSecret,
} from "../src/lib/config/security-secrets";

function env(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...process.env, ...values };
}

describe("durable worker security configuration", () => {
  it("requires a private 32-byte runner secret in production", () => {
    expect(() => loadWorkerRunnerSecret(env({ NODE_ENV: "production", WORKER_RUNNER_SECRET: "short" })))
      .toThrow("at least 32 bytes");
    expect(loadWorkerRunnerSecret(env({
      NODE_ENV: "production",
      WORKER_RUNNER_SECRET: "a-private-worker-runner-secret-longer-than-32-bytes",
    }))).toBe("a-private-worker-runner-secret-longer-than-32-bytes");
  });

  it("keeps the AI planner off by default and rejects ambiguous feature values", () => {
    expect(loadWorkerAIPlannerConfig(env({ WORKER_AI_PLANNER_ENABLED: undefined }))).toEqual({ enabled: false });
    expect(() => loadWorkerAIPlannerConfig(env({ WORKER_AI_PLANNER_ENABLED: "yes" })))
      .toThrow("either true or false");
  });

  it("requires server-side provider configuration before enabling the planner", () => {
    expect(() => loadWorkerAIPlannerConfig(env({
      WORKER_AI_PLANNER_ENABLED: "true",
      OPENAI_API_KEY: undefined,
      WORKER_AI_MODEL: "test-model",
    }))).toThrow("OPENAI_API_KEY");
    expect(loadWorkerAIPlannerConfig(env({
      WORKER_AI_PLANNER_ENABLED: "true",
      OPENAI_API_KEY: "private-test-key",
      WORKER_AI_MODEL: "test-model",
    }))).toEqual({ enabled: true, apiKey: "private-test-key", model: "test-model" });
  });
});
