import { z } from "zod";

export const workerAssignmentIdParamsSchema = z.object({
  assignmentId: z.string().uuid("A valid worker assignment ID is required."),
});

export const workerQuestionParamsSchema = z.object({
  assignmentId: z.string().uuid("A valid worker assignment ID is required."),
  questionId: z.string().uuid("A valid worker material-question ID is required."),
});

export const workerQuestionAnswerSchema = z.object({
  answerType: z.enum(["ACKNOWLEDGED", "WILL_CORRECT_SOURCE", "EXPLAINED_WITH_NOTE"]),
  note: z.string().trim().min(1, "A professional coordination note is required.").max(2_000),
}).strict();
