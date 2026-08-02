import { AsyncLocalStorage } from "node:async_hooks";
import type { CurrentActor } from "./current-actor";

const actorStorage = new AsyncLocalStorage<CurrentActor>();

/**
 * Makes the authenticated actor available to repository code (for audit-log
 * attribution) without threading it through every function signature.
 * `enterWith` scopes the store to the rest of the current request's async
 * continuation, which is safe here because each Next.js route handler
 * invocation runs as its own root async context.
 */
export function setActorContext(actor: CurrentActor): void {
  actorStorage.enterWith(actor);
}

export function getActorFromContext(): CurrentActor | undefined {
  return actorStorage.getStore();
}
