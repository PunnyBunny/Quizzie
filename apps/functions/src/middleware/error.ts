import express, { Request, Response } from "express";

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: "Not Found" });
};

export const errorHandler = ((err: unknown, _: Request, res: Response) => {
  console.error("[API Error]", err);
  const message = err instanceof Error ? err.message : "Internal Server Error";
  res.status(500).json({ ok: false, error: message });
}) as express.ErrorRequestHandler;
