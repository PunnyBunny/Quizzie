import type { Request, Response } from "express";

export type FirebaseFunctionRequest<Input> = Request<{}, {}, { data: Input }>;
export type FirebaseFunctionResponse<Output> = Response<
  { data: Output },
  { callerEmail: string; callerClaims?: Record<string, unknown> }
>;
