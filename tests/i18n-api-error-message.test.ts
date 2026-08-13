import { describe, expect, it } from "vitest";
import { ApiClientError } from "@/lib/api/client";
import { getLocalizedApiErrorMessage } from "@/lib/i18n/api-error-message";
import ar from "@/lib/i18n/dictionaries/ar";
import en from "@/lib/i18n/dictionaries/en";
import { createTranslator } from "@/lib/i18n/translate";

describe("localized API error fallback", () => {
  it("does not expose server-authored English diagnostics in Arabic", () => {
    const error = new ApiClientError({ code: "UNEXPECTED_FAILURE", message: "Internal English detail" });

    expect(getLocalizedApiErrorMessage(error, createTranslator(ar), "ar")).toBe(ar.errors.generic);
  });

  it("keeps the actionable Arabic network message", () => {
    const error = new ApiClientError({ code: "NETWORK_ERROR", message: "Network error" });

    expect(getLocalizedApiErrorMessage(error, createTranslator(ar), "ar")).toBe(ar.errors.network);
  });

  it("preserves the existing detailed English behavior", () => {
    const error = new ApiClientError({ code: "UNEXPECTED_FAILURE", message: "Detailed failure" });

    expect(getLocalizedApiErrorMessage(error, createTranslator(en), "en")).toBe("Detailed failure");
  });
});
