export type ApiFieldErrors = Record<string, string[]>;

export type ApiErrorPayload = {
  code: string;
  message: string;
  fieldErrors?: ApiFieldErrors;
};

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiFailure = {
  ok: false;
  error: ApiErrorPayload;
};

type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors?: ApiFieldErrors;

  constructor(error: ApiErrorPayload, status = 500) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.status = status;
    this.fieldErrors = error.fieldErrors;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers,
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiClientError({
      code: "NETWORK_ERROR",
      message: "The server could not be reached. Check the connection and try again.",
    });
  }

  let payload: ApiEnvelope<T>;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiClientError(
      {
        code: "INVALID_RESPONSE",
        message: "The server returned an invalid response. Please try again.",
      },
      response.status
    );
  }

  if (!response.ok || !payload.ok) {
    const error = !payload.ok
      ? payload.error
      : { code: "REQUEST_FAILED", message: "The request could not be completed." };
    throw new ApiClientError(error, response.status);
  }

  return payload.data;
}

export const apiClient = {
  get<T>(path: string, signal?: AbortSignal) {
    return request<T>(path, { method: "GET", signal });
  },
  post<T>(path: string, body?: unknown, signal?: AbortSignal) {
    return request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  },
  /** For multipart file uploads — passes FormData through untouched so the browser sets the correct boundary Content-Type. */
  postForm<T>(path: string, formData: FormData, signal?: AbortSignal) {
    return request<T>(path, { method: "POST", body: formData, signal });
  },
  put<T>(path: string, body: unknown, signal?: AbortSignal) {
    return request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
      signal,
    });
  },
  delete<T>(path: string, signal?: AbortSignal) {
    return request<T>(path, { method: "DELETE", signal });
  },
};

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}
