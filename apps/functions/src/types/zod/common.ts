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
