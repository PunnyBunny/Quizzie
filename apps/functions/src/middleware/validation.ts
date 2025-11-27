import { NextFunction, Request, Response } from "express";
import { z } from "zod";

export function validate(schema: z.ZodTypeAny) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as unknown;
      const payload =
        body && typeof body === "object" && "data" in body
          ? (body as Record<string, unknown>).data
          : body;

      await schema.parseAsync(payload);
      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ ok: false, error: "Invalid request", issues: error.issues });
        return;
      }
      next(error);
    }
  };
}
