export type Language = "cantonese" | "mandarin" | "english" | "other";
export type Gender = "male" | "female";

export interface LanguageEntry {
  language: Language;
  otherSpecify?: string;
}
