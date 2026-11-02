import type { NextFunction, Request, Response } from "express";
import type { ApiErrorOutput, CallableErrorStatus } from "@vaca/contracts";

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Not found") {
    super(message, 404);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

const statuses: Partial<Record<number, CallableErrorStatus>> = {
  400: "INVALID_ARGUMENT",
  401: "UNAUTHENTICATED",
  403: "PERMISSION_DENIED",
  404: "NOT_FOUND",
  405: "UNIMPLEMENTED",
  408: "DEADLINE_EXCEEDED",
  409: "ABORTED",
  412: "FAILED_PRECONDITION",
  413: "RESOURCE_EXHAUSTED",
  415: "INVALID_ARGUMENT",
  422: "INVALID_ARGUMENT",
  429: "RESOURCE_EXHAUSTED",
  499: "CANCELLED",
  500: "INTERNAL",
  501: "UNIMPLEMENTED",
  503: "UNAVAILABLE",
  504: "DEADLINE_EXCEEDED",
};

// body-parser marks its own client errors with a type and exposes them. Require
// the matching Error shape too; an arbitrary thrown status must never be public.
function parserError(error: unknown): ApiError | undefined {
  if (
    !(error instanceof Error) ||
    !("type" in error) ||
    !("status" in error) ||
    !("expose" in error) ||
    error.expose !== true
  )
    return;
  if (
    error.type === "entity.parse.failed" &&
    error.status === 400 &&
    error instanceof SyntaxError &&
    "body" in error
  ) {
    return new ApiError("Invalid JSON", 400);
  }
  if (error.type === "entity.too.large" && error.status === 413 && "limit" in error) {
    return new ApiError("Request body too large", 413);
  }
  if (
    ((error.type === "charset.unsupported" && "charset" in error) ||
      (error.type === "encoding.unsupported" && "encoding" in error)) &&
    error.status === 415
  ) {
    return new ApiError("Unsupported request encoding", 415);
  }
  if (
    ((error.type === "request.aborted" && "received" in error) ||
      (error.type === "request.size.invalid" && "length" in error)) &&
    error.status === 400
  ) {
    return new ApiError("Invalid request body", 400);
  }
  return undefined;
}

export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError("Not Found"));
};

export const errorHandler = (err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const known = err instanceof ApiError ? err : parserError(err);
  if (!known) console.error("[Error]", err);
  const statusCode = known?.statusCode ?? 500;
  const output: ApiErrorOutput = {
    error: {
      status: statuses[statusCode] ?? "UNKNOWN",
      message: known?.message ?? "Internal Server Error",
      ...(known?.details === undefined ? {} : { details: known.details }),
    },
  };
  res.status(statusCode).json(output);
};
