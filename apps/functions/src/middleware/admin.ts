import type { NextFunction } from "express";
import { FirebaseFunctionRequest, FirebaseFunctionResponse } from "../utils/express";
import { ForbiddenError } from "./error";

export function adminHandler(
  _req: FirebaseFunctionRequest<unknown>,
  res: FirebaseFunctionResponse<unknown>,
  next: NextFunction,
) {
  const claims = res.locals.callerClaims;
  if (!claims?.isAdmin) {
    throw new ForbiddenError();
  }
  next();
}
