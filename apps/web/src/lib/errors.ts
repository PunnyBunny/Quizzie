import { FirebaseError } from "firebase/app";

const FIREBASE_MESSAGES: Record<string, string> = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/user-disabled": "This account has been disabled. Contact an administrator.",
  "auth/user-not-found": "No account exists for that email.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "functions/unauthenticated": "You need to sign in again to do that.",
  "functions/permission-denied": "You don't have permission to perform this action.",
  "functions/not-found": "The requested resource could not be found.",
  "functions/already-exists": "That item already exists.",
  "functions/invalid-argument": "Some of the information provided is invalid.",
  "functions/resource-exhausted": "Too many requests. Please wait and try again.",
  "functions/unavailable": "The service is temporarily unavailable. Please try again shortly.",
  "functions/deadline-exceeded": "The request took too long. Please try again.",
  "functions/internal": "Something went wrong on our side. Please try again.",
};

export function toUserMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof FirebaseError) {
    const mapped = FIREBASE_MESSAGES[err.code];
    if (mapped) return mapped;
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.length > 0) return err;
  return fallback;
}
