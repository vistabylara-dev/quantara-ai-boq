import { AppError, NotFoundError } from "@/lib/errors/app-error";
import { getProviderById } from "@/lib/integrations/provider-registry";
import type {
  ArcadeCapabilityConfiguration,
  ArcadeProviderConfiguration,
} from "./arcade-types";

/**
 * Native connectors keep their existing OAuth and token lifecycle. Adding an
 * Arcade runtime must never silently replace one of these implementations.
 */
const NATIVE_ONLY_PROVIDER_IDS = new Set(["google-drive"]);

type ArcadeProviderValidationEnvironment = {
  readonly [name: string]: string | undefined;
  readonly NODE_ENV?: string;
};

/**
 * Release 1 intentionally ships no production Arcade-backed provider. A
 * provider is added here only after its concrete tool mapping, authorization,
 * normalizers, and selected ProjectFile import path have all been tested.
 */
export const ARCADE_PROVIDER_CONFIGURATIONS: readonly ArcadeProviderConfiguration[] = Object.freeze([]);

function validateToolName(toolName: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]*\.[A-Za-z][A-Za-z0-9_-]*$/.test(toolName);
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "[::1]";
}

function validateAuthorizationOrigin(
  value: string,
  environment: ArcadeProviderValidationEnvironment,
): boolean {
  try {
    const parsed = new URL(value);
    const isDevelopmentLoopback = parsed.protocol === "http:"
      && isLoopbackHostname(parsed.hostname)
      && environment.NODE_ENV !== "production";

    return (
      (parsed.protocol === "https:" || isDevelopmentLoopback)
      && !parsed.username
      && !parsed.password
      && parsed.pathname === "/"
      && !parsed.search
      && !parsed.hash
      // Require a canonical, origin-only value so comparisons cannot be
      // weakened by path, slash, encoding, or credential ambiguity.
      && value === parsed.origin
    );
  } catch {
    return false;
  }
}

function assertCapabilityConfiguration(
  provider: ArcadeProviderConfiguration,
  capabilityId: string,
  capability: ArcadeCapabilityConfiguration,
): void {
  if (!/^[A-Z][A-Z0-9_]*$/.test(capabilityId)) {
    throw new AppError(
      "ARCADE_INVALID_CONFIGURATION",
      "Arcade provider configuration is invalid.",
      503,
    );
  }

  if (
    !validateToolName(capability.authorizationTool)
    || !validateToolName(capability.executionTool)
    || !provider.authorizationTools.includes(capability.authorizationTool)
    || !provider.authorizationTools.includes(capability.executionTool)
  ) {
    throw new AppError(
      "ARCADE_INVALID_CONFIGURATION",
      "Arcade provider configuration is invalid.",
      503,
    );
  }
}

export function validateArcadeProviderConfigurations(
  configurations: readonly ArcadeProviderConfiguration[],
  environment: ArcadeProviderValidationEnvironment = process.env,
): void {
  const providerIds = new Set<string>();

  for (const provider of configurations) {
    if (
      provider.runtime !== "arcade"
      || !provider.providerId
      || providerIds.has(provider.providerId)
      || NATIVE_ONLY_PROVIDER_IDS.has(provider.providerId)
      || !getProviderById(provider.providerId)
      || provider.authorizationOrigins.length === 0
      || new Set(provider.authorizationOrigins).size !== provider.authorizationOrigins.length
      || provider.authorizationOrigins.some((origin) => !validateAuthorizationOrigin(origin, environment))
      || provider.authorizationTools.length === 0
      || new Set(provider.authorizationTools).size !== provider.authorizationTools.length
      || provider.authorizationTools.some((toolName) => !validateToolName(toolName))
    ) {
      throw new AppError(
        "ARCADE_INVALID_CONFIGURATION",
        "Arcade provider configuration is invalid.",
        503,
      );
    }

    providerIds.add(provider.providerId);
    for (const [capabilityId, capability] of Object.entries(provider.capabilities)) {
      assertCapabilityConfiguration(provider, capabilityId, capability);
    }
  }
}

export function findArcadeProviderConfiguration(
  providerId: string,
  configurations: readonly ArcadeProviderConfiguration[] = ARCADE_PROVIDER_CONFIGURATIONS,
): ArcadeProviderConfiguration | undefined {
  return configurations.find((configuration) => configuration.providerId === providerId);
}

export function resolveArcadeProviderConfiguration(
  providerId: string,
  configurations: readonly ArcadeProviderConfiguration[] = ARCADE_PROVIDER_CONFIGURATIONS,
): ArcadeProviderConfiguration {
  if (!getProviderById(providerId)) {
    throw new NotFoundError("Integration provider not found.");
  }

  const configuration = findArcadeProviderConfiguration(providerId, configurations);
  if (!configuration) {
    throw new AppError(
      "ARCADE_PROVIDER_NOT_SUPPORTED",
      "This integration provider is not available through the Arcade runtime.",
      501,
    );
  }
  return configuration;
}

export function resolveArcadeCapability(
  providerId: string,
  capabilityId: string,
  configurations: readonly ArcadeProviderConfiguration[] = ARCADE_PROVIDER_CONFIGURATIONS,
): { provider: ArcadeProviderConfiguration; capability: ArcadeCapabilityConfiguration } {
  const provider = resolveArcadeProviderConfiguration(providerId, configurations);
  const capability = provider.capabilities[capabilityId];

  if (!capability) {
    throw new AppError(
      "ARCADE_CAPABILITY_NOT_SUPPORTED",
      "This integration capability is not supported for the selected provider.",
      501,
    );
  }

  // This repeat check is deliberate. Even if a malformed config bypasses
  // startup validation, no call can escape the provider's explicit allowlist.
  if (
    !provider.authorizationTools.includes(capability.authorizationTool)
    || !provider.authorizationTools.includes(capability.executionTool)
  ) {
    throw new AppError(
      "ARCADE_INVALID_CONFIGURATION",
      "Arcade provider configuration is invalid.",
      503,
    );
  }

  return { provider, capability };
}
