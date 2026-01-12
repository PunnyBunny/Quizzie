import { Response } from "express";

/**
 * Standard error types for API responses
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(message, 403);
    this.name = "UnauthorizedError";
  }
}

/**
 * Handle API errors and send appropriate response
 */
export function handleError(error: unknown, res: Response): void {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  const message = error instanceof Error ? error.message : "Unknown error";

  // Map common error messages to appropriate status codes
  if (message === "Assessment not found" || message.includes("not found")) {
    res.status(404).json({ error: message });
  } else if (message === "Unauthorized" || message.includes("unauthorized")) {
    res.status(403).json({ error: message });
  } else {
    console.error("Unhandled error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
