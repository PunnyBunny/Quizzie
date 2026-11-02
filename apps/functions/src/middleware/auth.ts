import type { Request, Response, NextFunction } from "express";
import { FirebaseAuthError, type DecodedIdToken } from "firebase-admin/auth";
import { admin } from "../firebase";
import { ApiError } from "./error";

function isTokenRejection(error: unknown): boolean {
  if (!(error instanceof FirebaseAuthError)) return false;
  if (error.code === "auth/argument-error") {
    // The SDK also wraps public-key fetch failures in argument-error. Only its
    // known token-validation messages represent client failures; fail closed to
    // an internal error when an SDK update introduces an unfamiliar message.
    return (
      error.message.startsWith("Decoding Firebase ID token failed.") ||
      error.message.startsWith("Firebase ID token has ") ||
      error.message.startsWith("verifyIdToken() expects an ID token,")
    );
  }
  return ["auth/id-token-expired", "auth/id-token-revoked", "auth/invalid-id-token"].includes(
    error.code,
  );
}

/** Appends the verified caller's email and claims to res.locals. */
export const authHandler = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken) {
    next(new ApiError("Unauthorized", 401));
    return;
  }

  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    next(isTokenRejection(error) ? new ApiError("Unauthorized", 401) : error);
    return;
  }
  if (typeof decodedToken.email !== "string" || !decodedToken.email.trim()) {
    next(new ApiError("Unauthorized", 401));
    return;
  }
  res.locals.callerEmail = decodedToken.email;
  res.locals.callerClaims = decodedToken;
  next();
};
