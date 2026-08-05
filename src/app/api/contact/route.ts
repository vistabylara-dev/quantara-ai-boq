import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma"; // Assuming prisma is exported here

const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  workEmail: z.string().email("Invalid email address"),
  companyType: z.string().optional(),
  constructionDiscipline: z.string().optional(),
  currentBoqProcess: z.string().optional(),
  monthlyVolume: z.string().optional(),
  requiredInputs: z.string().optional(),
  requiredOutputs: z.string().optional(),
  numberOfUsers: z.string().optional(),
  integrationRequirements: z.string().optional(),
  preferredContactMethod: z.string().optional(),
  consent: z.boolean().optional(),
  // Fallbacks for the previous version schema
  companySize: z.string().optional().default("Unknown"),
  useCase: z.string().optional().default("Unknown"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validatedData = contactSchema.parse(body);

    await prisma.salesInquiry.create({
      data: {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        workEmail: validatedData.workEmail,
        companySize: validatedData.companySize,
        useCase: validatedData.useCase,
        companyType: validatedData.companyType,
        constructionDiscipline: validatedData.constructionDiscipline,
        currentBoqProcess: validatedData.currentBoqProcess,
        monthlyVolume: validatedData.monthlyVolume,
        requiredInputs: validatedData.requiredInputs,
        requiredOutputs: validatedData.requiredOutputs,
        numberOfUsers: validatedData.numberOfUsers,
        integrationRequirements: validatedData.integrationRequirements,
        preferredContactMethod: validatedData.preferredContactMethod,
        consent: validatedData.consent,
        deliveryStatus: "stored", // The constraint specifically says to log this
      },
    });

    return NextResponse.json({ success: true, message: "Request received" }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, message: error.errors[0].message }, { status: 400 });
    }
    console.error("Sales inquiry error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
