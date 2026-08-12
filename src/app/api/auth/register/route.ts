import { apiSuccess, handleApiError, parseJsonBody } from "@/lib/http/api-response";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const earlyAccessRegisterSchema = z.object({
  email: z.string().trim().email("A valid email address is required.").max(255),
  interestTier: z.string().min(1, "Interest tier is required.").max(100),
});

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, earlyAccessRegisterSchema);
    
    // Store early access registration
    const registration = await prisma.earlyAccessRegistration.create({
      data: {
        email: input.email,
        interestTier: input.interestTier,
        status: "pending",
      }
    });

    return apiSuccess({ registered: true, id: registration.id }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
