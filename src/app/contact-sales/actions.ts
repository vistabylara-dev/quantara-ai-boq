"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const contactSalesSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  businessEmail: z.string().email("Invalid email address"),
  company: z.string().min(1, "Company name is required"),
  country: z.string().min(1, "Country is required"),
  accountingPlatform: z.string().min(1, "Accounting platform is required"),
  businessSize: z.string().min(1, "Business size is required"),
  numberOfEntities: z.string().min(1, "Number of entities is required"),
  useCase: z.string().min(1, "Use case is required"),
  contactMethod: z.string().min(1, "Contact method is required"),
  privacyConsent: z.boolean().refine((val) => val === true, {
    message: "You must agree to the privacy policy",
  }),
});

export async function submitContactSalesRequest(formData: FormData) {
  try {
    const data = {
      fullName: formData.get("fullName") as string,
      businessEmail: formData.get("businessEmail") as string,
      company: formData.get("company") as string,
      country: formData.get("country") as string,
      accountingPlatform: formData.get("accountingPlatform") as string,
      businessSize: formData.get("businessSize") as string,
      numberOfEntities: formData.get("numberOfEntities") as string,
      useCase: formData.get("useCase") as string,
      contactMethod: formData.get("contactMethod") as string,
      privacyConsent: formData.get("privacyConsent") === "on",
    };

    const validatedData = contactSalesSchema.parse(data);

    await prisma.contactSalesRequest.create({
      data: {
        ...validatedData,
        deliveryStatus: "stored",
      },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: "Please check your inputs and try again.", errors: error.errors };
    }
    console.error("Failed to submit contact sales request:", error);
    return { success: false, message: "An unexpected error occurred. Please try again later." };
  }
}
