import { z } from "zod";
import type {
  AdminCreateUserInput,
  AdminExportAssessmentsInput,
  AdminGetAssessmentsInput,
  AdminRemoveUserInput,
  AdminResetPasswordInput,
} from "@vaca/contracts";

export const AdminCreateUserSchema = z.object({
  email: z.email(),
}) satisfies z.ZodType<AdminCreateUserInput>;

export const AdminResetPasswordSchema = z.object({
  email: z.email(),
}) satisfies z.ZodType<AdminResetPasswordInput>;

export const AdminRemoveUserSchema = z.object({
  email: z.email(),
}) satisfies z.ZodType<AdminRemoveUserInput>;

export const AdminGetAssessmentsSchema = z.object({
  archived: z.boolean().optional(),
}) satisfies z.ZodType<AdminGetAssessmentsInput>;

export const AdminExportAssessmentsSchema = z.strictObject(
  {},
) satisfies z.ZodType<AdminExportAssessmentsInput>;
