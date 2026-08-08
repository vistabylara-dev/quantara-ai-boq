export const ARCADE_RUNTIME_NAME = "arcade" as const;

export type ArcadeRuntimeStatus =
  | "READY"
  | "NOT_CONFIGURED"
  | "INVALID_CONFIGURATION";

export type ArcadeConfigurationStatus = {
  configured: boolean;
  runtime: typeof ARCADE_RUNTIME_NAME;
  status: ArcadeRuntimeStatus;
};

export type ArcadeAuthorizationStatus =
  | "not_started"
  | "pending"
  | "completed"
  | "failed";

export type ArcadeAuthorizationResult = {
  authorizationId: string | null;
  status: ArcadeAuthorizationStatus;
  authorizationUrl: string | null;
};

export type ArcadeAuthorizationStartResult = ArcadeAuthorizationResult & {
  /**
   * Short-lived Quantara transaction proof. This is not an Arcade/provider
   * OAuth token and contains no actor, tenant, provider, or authorization ID.
   */
  authorizationTransactionToken: string;
};

export type ArcadeActorIdentity = {
  companyId: string;
  userId: string;
};

export type ArcadeCapabilityConfiguration = {
  /** Exact Arcade tool selected by server code for authorization. */
  authorizationTool: string;
  /** Exact Arcade tool selected by server code for execution. */
  executionTool: string;
  toolVersion?: string;
  /** Converts a Quantara-owned input into the provider tool's input. */
  normalizeInput: (input: unknown) => Record<string, unknown>;
  /** Converts provider output into an application-owned contract. */
  normalizeOutput: (output: unknown) => unknown;
};

export type ArcadeProviderConfiguration = {
  providerId: string;
  runtime: typeof ARCADE_RUNTIME_NAME;
  /** Exact browser authorization origins accepted from Arcade responses. */
  authorizationOrigins: readonly string[];
  authorizationTools: readonly string[];
  capabilities: Readonly<Record<string, ArcadeCapabilityConfiguration>>;
};

export type ArcadeAuthorizationResponse = {
  id?: string;
  status?: ArcadeAuthorizationStatus;
  url?: string;
  user_id?: string;
  provider_id?: string;
  scopes?: string[];
  // The real SDK can return an OAuth token here. Runtime callers must never
  // receive or serialize this object; it exists in this port only so tests
  // can prove the sanitization boundary.
  context?: {
    token?: string;
    user_info?: Record<string, unknown>;
  };
};

export type ArcadeExecutionResponse = {
  id?: string;
  success?: boolean;
  status?: string;
  output?: {
    value?: unknown;
    authorization?: ArcadeAuthorizationResponse;
    error?: {
      kind?: string;
      message?: string;
      developer_message?: string;
      stacktrace?: string;
      extra?: Record<string, unknown>;
      can_retry?: boolean;
      status_code?: number;
    };
    logs?: Array<{ level: string; message: string }>;
  };
};

export type ArcadeRequestOptions = {
  maxRetries?: number;
  timeout?: number;
};

/**
 * Narrow port around @arcadeai/arcadejs. The published SDK's APIPromise is a
 * Promise subclass, so the real client satisfies this interface while tests
 * can inject a small deterministic fake without making network calls.
 */
export type ArcadeClient = {
  tools: {
    authorize(
      body: {
        tool_name: string;
        user_id: string;
        tool_version?: string;
      },
      options?: ArcadeRequestOptions,
    ): Promise<ArcadeAuthorizationResponse>;
    execute(
      body: {
        tool_name: string;
        user_id: string;
        input: Record<string, unknown>;
        tool_version?: string;
        include_error_stacktrace: false;
      },
      options?: ArcadeRequestOptions,
    ): Promise<ArcadeExecutionResponse>;
  };
  auth: {
    status(
      query: { id: string; wait?: number },
      options?: ArcadeRequestOptions,
    ): Promise<ArcadeAuthorizationResponse>;
  };
};

export type ArcadeExternalFileSeed = {
  providerSourceId: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
  sourceVersion?: string | null;
  sourceTimestamp?: string | null;
};
