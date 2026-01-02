import { Request, Response, NextFunction } from "express";
import { admin } from "../firebase";

/**
 * Appends the caller's email as [res.locals.callerEmail].
 * See https://fireship.io/lessons/secure-firebase-cloud-functions/#method-2---http-trigger-with-cors-and-token-decoding
 */
export const authHandler = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization ?? "";

  if (!authHeader.startsWith("Bearer ")) {
    console.error(
      "No Firebase ID token was passed as a Bearer token in the Authorization header.",
      authHeader,
    );
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    res.locals.callerEmail = decodedToken.email ?? null;
    next();
  } catch (err) {
    console.error("Error verifying Firebase ID token:", err);
    res.status(401).json({ ok: false, error: "Unauthorized" });
  }
};
