import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "INTERNAL_ERROR"
  | "PAYMENT_REQUIRED"
  | "UNAUTHORIZED";

const defaultMessages: Record<ApiErrorCode, string> = {
  BAD_REQUEST: "Bad request.",
  FORBIDDEN: "Forbidden.",
  INTERNAL_ERROR: "Unexpected server error.",
  PAYMENT_REQUIRED: "Payment required.",
  UNAUTHORIZED: "Unauthorized.",
};

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;

  constructor(message: string, status = 500, code: ApiErrorCode = "INTERNAL_ERROR") {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function apiOk<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(input: {
  code?: ApiErrorCode;
  error?: unknown;
  message?: string;
  requestId?: string;
  status?: number;
  extra?: Record<string, unknown>;
}) {
  const code = input.code || "INTERNAL_ERROR";
  const message =
    input.message ||
    (input.error instanceof Error ? input.error.message : defaultMessages[code]);

  return NextResponse.json(
    {
      ...input.extra,
      code,
      error: message,
      request_id: input.requestId || crypto.randomUUID(),
    },
    { status: input.status || 500 },
  );
}

export function handleApiError(
  error: unknown,
  fallbackMessage: string,
  options?: {
    requestId?: string;
    status?: number;
    extra?: Record<string, unknown>;
  },
) {
  if (error instanceof ApiError) {
    return apiError({
      code: error.code,
      error,
      extra: options?.extra,
      requestId: options?.requestId,
      status: error.status,
    });
  }

  return apiError({
    error,
    extra: options?.extra,
    message: error instanceof Error ? error.message : fallbackMessage,
    requestId: options?.requestId,
    status: options?.status || 500,
  });
}
