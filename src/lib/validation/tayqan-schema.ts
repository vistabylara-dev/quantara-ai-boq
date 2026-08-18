import { z } from "zod";
import { TAYQAN_HIRE_PLANS } from "@/lib/tayqan/tayqan-commerce";

const priceCodes = TAYQAN_HIRE_PLANS.map((plan) => plan.priceCode) as [
  (typeof TAYQAN_HIRE_PLANS)[number]["priceCode"],
  ...(typeof TAYQAN_HIRE_PLANS)[number]["priceCode"][],
];

export const tayqanCheckoutSchema = z
  .object({
    priceCode: z.enum(priceCodes),
    projectId: z.string().trim().min(1).max(200),
    boqId: z.string().uuid().optional(),
  })
  .strict();

export const tayqanIntakeAnswerSchema = z
  .object({
    sessionId: z.string().uuid(),
    questionKey: z.string().trim().min(1).max(100),
    answer: z.string().trim().min(1).max(4000),
  })
  .strict();

export const tayqanStartSchema = z
  .object({
    sessionId: z.string().uuid(),
  })
  .strict();

export const tayqanWorkOrderAdvanceSchema = z.object({ workOrderId: z.string().uuid() }).strict();

export const tayqanWorkOrderAnswerSchema = z.object({
  workOrderId: z.string().uuid(),
  action: z.enum([
    "CONFIRM_ENTITY", "CORRECT_ENTITY", "REJECT_ENTITY", "SET_QUANTITY", "SET_RATE", "ANSWER_QA", "RETRY",
    // PR1 correctness/completion-safety mission 3: governed, audited
    // resolution of a TAYQAN measurement exception (see tayqan-work-order-service.ts).
    "RESOLVE_MEASUREMENT_EXCEPTION",
  ]),
  entityId: z.string().uuid().optional(),
  quantity: z.number().finite().min(0).optional(),
  unit: z.string().trim().min(1).max(50).optional(),
  unitCost: z.number().finite().min(0).optional(),
  note: z.string().trim().max(4000).optional(),
  label: z.string().trim().max(1000).optional(),
  qaAnswerType: z.enum(["ACKNOWLEDGED", "WILL_CORRECT_SOURCE", "EXPLAINED_WITH_NOTE"]).optional(),
  /** Required for RESOLVE_MEASUREMENT_EXCEPTION; identifies the ledger entry. */
  exceptionKey: z.string().trim().min(1).max(64).optional(),
}).strict();

/** PR1 mission 5: explicit final professional acceptance of a TAYQAN deliverable. */
export const tayqanWorkOrderAcceptSchema = z.object({ workOrderId: z.string().uuid() }).strict();

export type TayqanCheckoutInput = z.output<typeof tayqanCheckoutSchema>;
export type TayqanIntakeAnswerInput = z.output<typeof tayqanIntakeAnswerSchema>;
export type TayqanStartInput = z.output<typeof tayqanStartSchema>;
export type TayqanWorkOrderAdvanceInput = z.output<typeof tayqanWorkOrderAdvanceSchema>;
export type TayqanWorkOrderAnswerInput = z.output<typeof tayqanWorkOrderAnswerSchema>;
export type TayqanWorkOrderAcceptInput = z.output<typeof tayqanWorkOrderAcceptSchema>;
