import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "./error";

export function validate(schema: z.ZodType) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Clean up req.body.data
      const body = req.body as unknown;
      const envelope = body && typeof body === "object" && "data" in body ? body : { data: body };

      req.body = { ...envelope, data: await schema.parseAsync(envelope.data) };
      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ApiError("Invalid request", 400, { issues: error.issues }));
        return;
      }
      next(error);
    }
  };
}
