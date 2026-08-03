import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { UnauthorizedError } from "@/lib/errors/app-error";
import {
  PlatformAuthorizationError,
  requirePlatformActor,
} from "@/lib/auth/platform-authorization";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await requirePlatformActor();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/login?next=/admin");
    }
    if (error instanceof PlatformAuthorizationError) {
      redirect("/dashboard");
    }
    throw error;
  }

  return children;
}
