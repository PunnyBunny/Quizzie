export type Language = "cantonese" | "mandarin" | "english" | "other";
export type Gender = "male" | "female";

export interface LanguageEntryDto {
  language: Language;
  otherSpecify?: string;
}

export interface OkOutput {
  ok: true;
}
