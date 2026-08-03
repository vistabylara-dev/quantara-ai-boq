/**
 * Only ever points back within /admin. An unvalidated `next` query param
 * would otherwise be an open redirect on a page that just authenticated a
 * privileged platform account.
 */
export function safeAdminNext(rawNext: string | null | undefined): string {
  if (rawNext && rawNext.startsWith("/admin") && !rawNext.startsWith("//")) {
    return rawNext;
  }
  return "/admin";
}
