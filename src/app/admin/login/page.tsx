import { redirect } from "next/navigation";
import { isPlatformActor } from "@/lib/auth/platform-authorization";
import AdminLoginPageClient from "./admin-login-form";
import { safeAdminNext } from "./safe-next";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ next?: string }> };

export default async function AdminLoginPage({ searchParams }: PageProps) {
  if (await isPlatformActor()) {
    const params = await searchParams;
    redirect(safeAdminNext(params.next));
  }

  return <AdminLoginPageClient />;
}
