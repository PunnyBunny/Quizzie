import { NextFunction, Request, Response } from "express";
import { z } from "zod";

export function validate(schema: z.ZodTypeAny) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body.data);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ ok: false, error: "Invalid request", issues: error.issues });
      }
      next(error);
    }
  };
}
