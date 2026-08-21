import { AsyncLocalStorage } from "node:async_hooks";
import type { CurrentActor } from "./current-actor";

type ActorContextState = {
  actor?: CurrentActor;
};

const actorStorage = new AsyncLocalStorage<ActorContextState>();

/**
 * Initializes one isolated mutable actor slot for the complete lifetime of a
 * route handler. Cloudflare Workers supports AsyncLocalStorage.run(), but
 * intentionally does not implement enterWith(). Keeping the slot stable and
 * assigning the actor after authentication preserves audit attribution across
 * every awaited repository/service call without sharing state between
 * concurrent requests.
 */
export function withActorRequestContext<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
  return (...args) => actorStorage.run({}, () => handler(...args));
}

/**
 * Makes the authenticated actor available to repository code (for audit-log
 * attribution) without threading it through every function signature.
 * Production route handlers initialize the mutable request slot with
 * withActorRequestContext(). The enterWith fallback exists only for direct
 * Node callers such as repository integration tests; Workers will fail closed
 * with a clear error if a route is ever left unwrapped.
 */
export function setActorContext(actor: CurrentActor): void {
  const state = actorStorage.getStore();
  if (state) {
    state.actor = actor;
    return;
  }

  try {
    actorStorage.enterWith({ actor });
  } catch {
    throw new Error(
      "Actor request context was not initialized. Wrap the route handler with withActorRequestContext().",
    );
  }
}

export function getActorFromContext(): CurrentActor | undefined {
  return actorStorage.getStore()?.actor;
}
