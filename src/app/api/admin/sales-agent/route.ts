import { requirePlatformActor, PLATFORM_OWNER_ROLES } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { readSalesBudget } from "@/lib/repositories/sales-agent-budget-repository";
import { salesAIReady, PRICING_REVIEW_EXPIRES } from "@/lib/sales-agent/policy";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePlatformActor(PLATFORM_OWNER_ROLES);
    const [budget, inquiries] = await Promise.all([
      readSalesBudget(),
      prisma.salesInquiry.findMany({ take: 50, orderBy: { createdAt: "desc" } }),
    ]);
    return apiSuccess({ budget, inquiries, aiReady: salesAIReady(), pricingReviewExpires: PRICING_REVIEW_EXPIRES });
  } catch (error) { return handleApiError(error); }
}
