import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import {
  overrideSystemCalculatedBOQItemQuantityRecord,
} from "@/lib/repositories/boq-quantity-override-repository";
import {
  boqSystemQuantityOverrideInputSchema,
  type BOQSystemQuantityOverrideInput,
} from "@/lib/validation/boq-quantity-override-schema";

/**
 * Secondary, deliberate correction lane for a generated quantity. It requires
 * both BOQ edit authority and professional verification authority; ordinary
 * rate entry never reaches this service.
 */
export async function overrideSystemCalculatedBOQItemQuantity(
  actor: CurrentActor,
  itemId: string,
  rawInput: BOQSystemQuantityOverrideInput,
) {
  requireCapability(actor, "boq:edit");
  requireCapability(actor, "verification:manage");
  const input = boqSystemQuantityOverrideInputSchema.parse(rawInput);
  return overrideSystemCalculatedBOQItemQuantityRecord(actor, itemId, input);
}
