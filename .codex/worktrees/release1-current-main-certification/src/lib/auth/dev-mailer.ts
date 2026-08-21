/**
 * Development-mode email stand-in. No SMTP is configured for this phase, so
 * verification and reset links are logged to the server console instead of
 * being delivered. This must never be mistaken for real delivery.
 */
export function logDevEmailLink(kind: string, recipientEmail: string, url: string): void {
  console.log(
    `\n[DEV EMAIL - NOT SENT] ${kind}\n  To: ${recipientEmail}\n  Link: ${url}\n`,
  );
}

export function appBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}
