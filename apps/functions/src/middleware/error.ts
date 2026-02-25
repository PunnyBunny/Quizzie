import { NextFunction, Request, Response } from "express";

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
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: "Not Found" });
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error("[Error]", err);
  const message = err instanceof Error ? err.message : "Internal Server Error";
  res.status(500).json({ ok: false, error: message });
};
