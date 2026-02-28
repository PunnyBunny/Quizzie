import { z } from "zod";

export const LanguageSchema = z.enum(["cantonese", "mandarin", "english", "other"]);
export const GenderSchema = z.enum(["male", "female"]);

export const LanguageEntrySchema = z.object({
  language: LanguageSchema,
  otherSpecify: z.string().optional(),
});

export type Language = z.infer<typeof LanguageSchema>;
export type Gender = z.infer<typeof GenderSchema>;
export type LanguageEntry = z.infer<typeof LanguageEntrySchema>;
