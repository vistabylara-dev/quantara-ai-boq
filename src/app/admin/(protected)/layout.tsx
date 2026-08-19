import { PlatformRole } from "@prisma/client";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { UnauthorizedError } from "@/lib/errors/app-error";
import {
  PlatformAuthorizationError,
  requirePlatformActor,
} from "@/lib/auth/platform-authorization";
import { EnvironmentSafetyBanner } from "@/components/admin/environment-safety-banner";
import { getPlatformEnvironmentBanner } from "@/lib/services/platform-admin-service";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/admin/login?next=/admin");
    }
    if (error instanceof PlatformAuthorizationError) {
      redirect("/dashboard");
    }
    throw error;
  }

  return (
    <>
      <EnvironmentSafetyBanner {...getPlatformEnvironmentBanner()} />
      {children}
    </>
  );
}
