import { z } from "zod";

export const AdminCreateUserSchema = z.object({
  email: z.email(),
});

export const AdminResetPasswordSchema = z.object({
  email: z.email(),
});

export const AdminRemoveUserSchema = z.object({
  email: z.email(),
});

export type AdminCreateUserInput = z.infer<typeof AdminCreateUserSchema>;
export type AdminResetPasswordInput = z.infer<typeof AdminResetPasswordSchema>;
export type AdminRemoveUserInput = z.infer<typeof AdminRemoveUserSchema>;
