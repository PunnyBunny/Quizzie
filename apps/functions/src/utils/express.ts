import type { Request, Response } from "express";

export type FirebaseFunctionRequest<T> = Request<{}, {}, { data: T }>;
export type FirebaseFunctionResponse<T> = Response<
  { data: T },
  { callerEmail: string; callerClaims?: Record<string, unknown> }
>;
