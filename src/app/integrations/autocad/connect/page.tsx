import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{
    projectId?: string | string[];
    intent?: string | string[];
    returnTo?: string | string[];
  }>;
};

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export default async function AutoCadConnectRedirectPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const preservedParams = new URLSearchParams();

  for (const key of ["projectId", "intent", "returnTo"] as const) {
    const value = firstQueryValue(params[key]);
    if (value) preservedParams.set(key, value);
  }

  const query = preservedParams.toString();
  redirect(`/integrations/autodesk/connect${query ? `?${query}` : ""}`);
}
