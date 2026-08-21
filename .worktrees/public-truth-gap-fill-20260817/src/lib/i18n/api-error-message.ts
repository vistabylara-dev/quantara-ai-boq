import { ApiClientError, getApiErrorMessage } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n/config";
import type { TranslateFn } from "@/lib/i18n/translate";

/**
 * Keeps server-authored English diagnostics out of Arabic product surfaces.
 * Known, user-actionable feature codes should still be mapped by the caller;
 * this is the safe fallback for transport and unexpected API failures.
 */
export function getLocalizedApiErrorMessage(
  error: unknown,
  t: TranslateFn,
  locale: Locale,
): string {
  if (locale === "en") return getApiErrorMessage(error);
  if (error instanceof ApiClientError && error.code === "NETWORK_ERROR") {
    return t("errors.network");
  }
  return t("errors.generic");
}
