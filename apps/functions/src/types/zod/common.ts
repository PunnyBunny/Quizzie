import { z } from "zod";
import type { Gender, Language, LanguageEntryDto } from "@vaca/contracts";

export const LanguageSchema = z.enum([
  "cantonese",
  "mandarin",
  "english",
  "other",
]) satisfies z.ZodType<Language>;
export const GenderSchema = z.enum(["male", "female"]) satisfies z.ZodType<Gender>;

export const LanguageEntrySchema = z.object({
  language: LanguageSchema,
  otherSpecify: z.string().optional(),
}) satisfies z.ZodType<LanguageEntryDto>;

// Firestore document ID constraints: https://firebase.google.com/docs/firestore/quotas
// Preserve opaque IDs exactly; whitespace is valid and must not be trimmed.
export const DocumentIdSchema = z
  .string()
  .min(1)
  .refine(
    (id) =>
      !id.includes("/") &&
      id !== "." &&
      id !== ".." &&
      !(id.length >= 4 && id.startsWith("__") && id.endsWith("__")) &&
      Buffer.byteLength(id, "utf8") <= 1500,
    { message: "Invalid Firestore document ID" },
  );
