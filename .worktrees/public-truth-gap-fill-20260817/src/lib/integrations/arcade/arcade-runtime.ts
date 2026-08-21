import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import Arcade from "@arcadeai/arcadejs";
import { AppError } from "@/lib/errors/app-error";
import {
  ARCADE_PROVIDER_CONFIGURATIONS,
  resolveArcadeCapability,
  resolveArcadeProviderConfiguration,
  validateArcadeProviderConfigurations,
} from "./arcade-provider-config";
import {
  ARCADE_RUNTIME_NAME,
  type ArcadeActorIdentity,
  type ArcadeAuthorizationResponse,
  type ArcadeAuthorizationResult,
  type ArcadeAuthorizationStartResult,
  type ArcadeClient,
  type ArcadeConfigurationStatus,
  type ArcadeProviderConfiguration,
} from "./arcade-types";

const DEFAULT_ARCADE_BASE_URL = "https://api.arcade.dev";
const AUTHORIZATION_STATUSES = new Set(["not_started", "pending", "completed", "failed"]);
const ARCADE_REQUEST_TIMEOUT_MS = 30_000;
const AUTHORIZATION_TRANSACTION_TTL_SECONDS = 10 * 60;
const AUTHORIZATION_TRANSACTION_CLOCK_SKEW_SECONDS = 30;
const AUTHORIZATION_TRANSACTION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,512}\.[A-Za-z0-9_-]{43}$/;

type ArcadeEnvironment = {
  readonly [name: string]: string | undefined;
  ARCADE_API_KEY?: string;
  ARCADE_BASE_URL?: string;
  NODE_ENV?: string;
};

type ResolvedArcadeEnvironment = {
  apiKey: string;
  baseUrl: string;
};

export type ArcadeRuntimeOptions = {
  client?: ArcadeClient;
  configurations?: readonly ArcadeProviderConfiguration[];
  environment?: ArcadeEnvironment;
};

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "[::1]";
}

function parseBaseUrl(rawValue: string, environment: ArcadeEnvironment): string | null {
  try {
    const url = new URL(rawValue);
    const isDevelopmentLoopback = url.protocol === "http:"
      && isLoopbackHostname(url.hostname)
      && environment.NODE_ENV !== "production";
    if (
      (url.protocol !== "https:" && !isDevelopmentLoopback)
      || url.username
      || url.password
      || url.search
      || url.hash
      || rawValue.includes("#")
    ) {
      return null;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function resolveEnvironment(environment: ArcadeEnvironment): ResolvedArcadeEnvironment | null {
  const apiKey = environment.ARCADE_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = parseBaseUrl(
    environment.ARCADE_BASE_URL?.trim() || DEFAULT_ARCADE_BASE_URL,
    environment,
  );
  if (!baseUrl) {
    throw new AppError(
      "ARCADE_INVALID_CONFIGURATION",
      "The Arcade runtime configuration is invalid.",
      503,
    );
  }
  return { apiKey, baseUrl };
}

export function getArcadeConfigurationStatus(
  environment: ArcadeEnvironment = process.env,
): ArcadeConfigurationStatus {
  if (!environment.ARCADE_API_KEY?.trim()) {
    return {
      configured: false,
      runtime: ARCADE_RUNTIME_NAME,
      status: "NOT_CONFIGURED",
    };
  }

  if (!parseBaseUrl(
    environment.ARCADE_BASE_URL?.trim() || DEFAULT_ARCADE_BASE_URL,
    environment,
  )) {
    return {
      configured: false,
      runtime: ARCADE_RUNTIME_NAME,
      status: "INVALID_CONFIGURATION",
    };
  }

  return {
    configured: true,
    runtime: ARCADE_RUNTIME_NAME,
    status: "READY",
  };
}

/** Stable, tenant-separated Arcade identity that contains no email or raw UUID. */
export function deriveArcadeUserId(actor: ArcadeActorIdentity): string {
  if (!actor.companyId.trim() || !actor.userId.trim()) {
    throw new AppError("ARCADE_IDENTITY_INVALID", "Arcade user identity is invalid.", 500);
  }
  const digest = createHash("sha256")
    .update(`quantara:arcade:v1:${actor.companyId}:${actor.userId}`)
    .digest("base64url");
  return `qtr_${digest}`;
}

type AuthorizationTransactionBinding = {
  actor: ArcadeActorIdentity;
  providerId: string;
  capability: string;
  authorizationId: string;
};

type AuthorizationTransactionClaims = {
  v: 1;
  iat: number;
  exp: number;
  nonce: string;
};

function authorizationTransactionError(): AppError {
  return new AppError(
    "ARCADE_AUTHORIZATION_TRANSACTION_INVALID",
    "The Arcade authorization transaction is invalid or expired.",
    403,
  );
}

function resolveAuthorizationTransactionSecret(environment: ArcadeEnvironment): string {
  const secret = environment.ARCADE_API_KEY?.trim();
  if (!secret) {
    throw new AppError(
      "ARCADE_NOT_CONFIGURED",
      "The Arcade integration runtime is not configured.",
      503,
    );
  }
  return secret;
}

function transactionBindingValue(binding: AuthorizationTransactionBinding): string {
  return JSON.stringify([
    "quantara:arcade:authorization:v1",
    binding.actor.companyId,
    binding.actor.userId,
    binding.providerId,
    binding.capability,
    binding.authorizationId,
  ]);
}

function signAuthorizationTransaction(
  secret: string,
  payloadSegment: string,
  binding: AuthorizationTransactionBinding,
): Buffer {
  return createHmac("sha256", secret)
    .update("quantara:arcade:authorization-transaction:v1\0")
    .update(payloadSegment)
    .update("\0")
    .update(transactionBindingValue(binding))
    .digest();
}

function issueAuthorizationTransaction(
  secret: string,
  binding: AuthorizationTransactionBinding,
  nowMs = Date.now(),
): string {
  const issuedAt = Math.floor(nowMs / 1000);
  const claims: AuthorizationTransactionClaims = {
    v: 1,
    iat: issuedAt,
    exp: issuedAt + AUTHORIZATION_TRANSACTION_TTL_SECONDS,
    nonce: randomBytes(16).toString("base64url"),
  };
  const payloadSegment = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const signature = signAuthorizationTransaction(secret, payloadSegment, binding);
  return `${payloadSegment}.${signature.toString("base64url")}`;
}

function verifyAuthorizationTransaction(
  secret: string,
  token: string,
  binding: AuthorizationTransactionBinding,
  nowMs = Date.now(),
): void {
  if (!AUTHORIZATION_TRANSACTION_TOKEN_PATTERN.test(token)) {
    throw authorizationTransactionError();
  }

  const [payloadSegment, signatureSegment] = token.split(".");
  const expectedSignature = signAuthorizationTransaction(secret, payloadSegment, binding);
  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(signatureSegment, "base64url");
  } catch {
    suppliedSignature = Buffer.alloc(0);
  }

  // Compare equal-length buffers unconditionally. Actor, tenant, provider,
  // capability, authorization ID, payload, or signature tampering therefore
  // all fail through the same constant-time signature comparison.
  const signatureLengthMatches = suppliedSignature.length === expectedSignature.length;
  const comparableSignature = signatureLengthMatches
    ? suppliedSignature
    : Buffer.alloc(expectedSignature.length);
  const signatureMatches = timingSafeEqual(expectedSignature, comparableSignature);
  if (!signatureLengthMatches || !signatureMatches) {
    throw authorizationTransactionError();
  }

  let claims: AuthorizationTransactionClaims;
  try {
    const parsed = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid transaction claims");
    }
    const record = parsed as Record<string, unknown>;
    if (
      Object.keys(record).sort().join(",") !== "exp,iat,nonce,v"
      || record.v !== 1
      || typeof record.iat !== "number"
      || !Number.isSafeInteger(record.iat)
      || typeof record.exp !== "number"
      || !Number.isSafeInteger(record.exp)
      || typeof record.nonce !== "string"
      || !/^[A-Za-z0-9_-]{22}$/.test(record.nonce)
    ) {
      throw new Error("invalid transaction claims");
    }
    claims = record as AuthorizationTransactionClaims;
  } catch {
    throw authorizationTransactionError();
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  if (
    claims.iat > nowSeconds + AUTHORIZATION_TRANSACTION_CLOCK_SKEW_SECONDS
    || claims.exp <= nowSeconds
    || claims.exp - claims.iat !== AUTHORIZATION_TRANSACTION_TTL_SECONDS
  ) {
    throw authorizationTransactionError();
  }
}

function controlledProviderError(error: unknown, operation: "authorization" | "status" | "execution"): AppError {
  const status = error && typeof error === "object" && "status" in error
    && typeof (error as { status?: unknown }).status === "number"
    ? (error as { status: number }).status
    : undefined;

  if (status === 429) {
    return new AppError("ARCADE_RATE_LIMITED", "The integration provider is temporarily rate limited.", 429);
  }
  if (status === 401 || status === 403) {
    // This is Arcade's server credential, not the signed-in Quantara user's
    // session. Never translate it into a misleading browser authentication
    // challenge.
    return new AppError(
      "ARCADE_RUNTIME_AUTHENTICATION_FAILED",
      "The Arcade integration runtime is not available.",
      503,
    );
  }
  if (status === 408 || status === 504) {
    return new AppError("ARCADE_TIMEOUT", "The integration provider timed out.", 504);
  }
  if (status !== undefined && status >= 500) {
    return new AppError("ARCADE_UNAVAILABLE", "The integration provider is temporarily unavailable.", 503);
  }
  if (status === 400 || status === 404 || status === 409 || status === 422) {
    return new AppError(
      "ARCADE_PROVIDER_REQUEST_REJECTED",
      "The integration provider rejected the request.",
      502,
    );
  }

  const code = operation === "execution"
    ? "ARCADE_EXECUTION_FAILED"
    : operation === "status"
      ? "ARCADE_AUTHORIZATION_STATUS_FAILED"
      : "ARCADE_AUTHORIZATION_FAILED";
  return new AppError(code, "The Arcade integration request could not be completed.", 502);
}

function isCredentialBearingQueryKey(key: string): boolean {
  const normalized = key.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized === "code"
    || normalized === "authorization"
    || normalized === "authorizationcode"
    || normalized === "authcode"
    || normalized === "oauthverifier"
    || normalized.endsWith("token")
    || normalized.endsWith("secret");
}

function sanitizeAuthorizationUrl(
  value: string | undefined,
  provider: ArcadeProviderConfiguration,
  environment: ArcadeEnvironment,
): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const isDevelopmentLoopback = parsed.protocol === "http:"
      && isLoopbackHostname(parsed.hostname)
      && environment.NODE_ENV !== "production";
    if (
      (parsed.protocol !== "https:" && !isDevelopmentLoopback)
      || parsed.username
      || parsed.password
      || value.includes("#")
      || !provider.authorizationOrigins.includes(parsed.origin)
      || Array.from(parsed.searchParams.keys()).some(isCredentialBearingQueryKey)
    ) {
      throw new Error("unsafe authorization URL");
    }
    return parsed.toString();
  } catch {
    throw new AppError("ARCADE_INVALID_RESPONSE", "Arcade returned an invalid authorization response.", 502);
  }
}

function sanitizeAuthorizationResponse(
  response: ArcadeAuthorizationResponse,
  expectedUserId: string,
  requireUserIdentity: boolean,
  provider: ArcadeProviderConfiguration,
  environment: ArcadeEnvironment,
): ArcadeAuthorizationResult {
  if (!response.status || !AUTHORIZATION_STATUSES.has(response.status)) {
    throw new AppError("ARCADE_INVALID_RESPONSE", "Arcade returned an invalid authorization response.", 502);
  }
  if (
    (requireUserIdentity && !response.user_id)
    || (response.user_id && response.user_id !== expectedUserId)
  ) {
    throw new AppError(
      "ARCADE_AUTHORIZATION_IDENTITY_MISMATCH",
      "The authorization flow does not belong to the signed-in user.",
      403,
    );
  }

  return {
    authorizationId: typeof response.id === "string" && response.id ? response.id : null,
    status: response.status,
    authorizationUrl: sanitizeAuthorizationUrl(response.url, provider, environment),
  };
}

function authorizationRequired(errorKind: string | undefined): boolean {
  return errorKind === "UPSTREAM_RUNTIME_AUTH_ERROR"
    || errorKind === "TOOL_RUNTIME_CONTEXT_REQUIRED"
    || errorKind === "CONTEXT_CHECK_FAILED"
    || errorKind === "CONTEXT_DENIED";
}

export class ArcadeRuntime {
  private client: ArcadeClient | null;
  private readonly configurations: readonly ArcadeProviderConfiguration[];
  private readonly environment: ArcadeEnvironment;

  constructor(options: ArcadeRuntimeOptions = {}) {
    this.client = options.client ?? null;
    this.configurations = options.configurations ?? ARCADE_PROVIDER_CONFIGURATIONS;
    this.environment = options.environment ?? process.env;
    validateArcadeProviderConfigurations(this.configurations, this.environment);
  }

  getConfigurationStatus(): ArcadeConfigurationStatus {
    return getArcadeConfigurationStatus(this.environment);
  }

  getProviderConfiguration(providerId: string): ArcadeProviderConfiguration {
    return resolveArcadeProviderConfiguration(providerId, this.configurations);
  }

  private getClient(): ArcadeClient {
    const resolved = resolveEnvironment(this.environment);
    if (!resolved) {
      throw new AppError(
        "ARCADE_NOT_CONFIGURED",
        "The Arcade integration runtime is not configured.",
        503,
      );
    }

    if (this.client) return this.client;

    this.client = new Arcade({
      apiKey: resolved.apiKey,
      baseURL: resolved.baseUrl,
      timeout: ARCADE_REQUEST_TIMEOUT_MS,
      logLevel: "off",
    }) as unknown as ArcadeClient;
    return this.client;
  }

  async authorize(input: {
    actor: ArcadeActorIdentity;
    providerId: string;
    capability: string;
  }): Promise<ArcadeAuthorizationStartResult> {
    const { provider, capability } = resolveArcadeCapability(
      input.providerId,
      input.capability,
      this.configurations,
    );
    const arcadeUserId = deriveArcadeUserId(input.actor);
    const transactionSecret = resolveAuthorizationTransactionSecret(this.environment);

    try {
      const response = await this.getClient().tools.authorize({
        tool_name: capability.authorizationTool,
        user_id: arcadeUserId,
        ...(capability.toolVersion ? { tool_version: capability.toolVersion } : {}),
      });
      const result = sanitizeAuthorizationResponse(
        response,
        arcadeUserId,
        false,
        provider,
        this.environment,
      );
      if (!result.authorizationId) {
        throw new AppError(
          "ARCADE_INVALID_RESPONSE",
          "Arcade returned an invalid authorization response.",
          502,
        );
      }
      return {
        ...result,
        authorizationTransactionToken: issueAuthorizationTransaction(
          transactionSecret,
          {
            actor: input.actor,
            providerId: input.providerId,
            capability: input.capability,
            authorizationId: result.authorizationId,
          },
        ),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw controlledProviderError(error, "authorization");
    }
  }

  async checkAuthorization(input: {
    actor: ArcadeActorIdentity;
    providerId: string;
    capability: string;
    authorizationId: string;
    authorizationTransactionToken: string;
  }): Promise<ArcadeAuthorizationResult> {
    // Resolve the capability even though Arcade's status endpoint only needs
    // an ID. This prevents an unconfigured provider/capability from using the
    // route as a general Arcade authorization lookup surface.
    const { provider } = resolveArcadeCapability(
      input.providerId,
      input.capability,
      this.configurations,
    );
    const arcadeUserId = deriveArcadeUserId(input.actor);
    const transactionSecret = resolveAuthorizationTransactionSecret(this.environment);
    verifyAuthorizationTransaction(
      transactionSecret,
      input.authorizationTransactionToken,
      {
        actor: input.actor,
        providerId: input.providerId,
        capability: input.capability,
        authorizationId: input.authorizationId,
      },
    );

    try {
      const response = await this.getClient().auth.status(
        { id: input.authorizationId, wait: 0 },
        { maxRetries: 1, timeout: 10_000 },
      );
      return sanitizeAuthorizationResponse(
        response,
        arcadeUserId,
        true,
        provider,
        this.environment,
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw controlledProviderError(error, "status");
    }
  }

  /** Internal-only execution API. No browser route exposes this method. */
  async execute(input: {
    actor: ArcadeActorIdentity;
    providerId: string;
    capability: string;
    input: unknown;
  }): Promise<unknown> {
    const { capability } = resolveArcadeCapability(
      input.providerId,
      input.capability,
      this.configurations,
    );
    const arcadeUserId = deriveArcadeUserId(input.actor);

    let normalizedInput: Record<string, unknown>;
    try {
      normalizedInput = capability.normalizeInput(input.input);
    } catch {
      throw new AppError("ARCADE_INPUT_INVALID", "The integration request is invalid.", 400);
    }

    try {
      const response = await this.getClient().tools.execute(
        {
          tool_name: capability.executionTool,
          user_id: arcadeUserId,
          input: normalizedInput,
          ...(capability.toolVersion ? { tool_version: capability.toolVersion } : {}),
          include_error_stacktrace: false,
        },
        // Arcade retries some transport and 5xx failures by default. Tool
        // execution is never retried here because future mapped tools may not
        // be idempotent.
        { maxRetries: 0, timeout: ARCADE_REQUEST_TIMEOUT_MS },
      );

      if (
        response.output?.authorization
        && response.output.authorization.status !== "completed"
      ) {
        throw new AppError(
          "ARCADE_AUTHORIZATION_REQUIRED",
          "Authorize this integration capability before using it.",
          409,
        );
      }

      if (response.output?.error) {
        if (authorizationRequired(response.output.error.kind)) {
          throw new AppError(
            "ARCADE_AUTHORIZATION_REQUIRED",
            "Authorize this integration capability before using it.",
            409,
          );
        }
        throw new AppError(
          "ARCADE_EXECUTION_FAILED",
          "The integration provider could not complete the request.",
          502,
        );
      }

      if (response.success === false) {
        throw new AppError(
          "ARCADE_EXECUTION_FAILED",
          "The integration provider could not complete the request.",
          502,
        );
      }

      try {
        return capability.normalizeOutput(response.output?.value);
      } catch {
        throw new AppError(
          "ARCADE_INVALID_RESPONSE",
          "The integration provider returned an invalid response.",
          502,
        );
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw controlledProviderError(error, "execution");
    }
  }
}

let sharedRuntime: ArcadeRuntime | null = null;

export function getArcadeRuntime(): ArcadeRuntime {
  if (!sharedRuntime) sharedRuntime = new ArcadeRuntime();
  return sharedRuntime;
}
