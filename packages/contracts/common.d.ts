export type Language = "cantonese" | "mandarin" | "english" | "other";
export type SpecialEducationalNeeds =
  | "none"
  | "autism_spectrum_disorder"
  | "developmental_language_disorder";
export type Gender = "male" | "female";

export interface LanguageEntryDto {
  language: Language;
  otherSpecify?: string;
}

export interface OkOutput {
  ok: true;
}

/** Canonical Google RPC status names understood by Firebase callable clients. */
export type CallableErrorStatus =
  | "CANCELLED"
  | "UNKNOWN"
  | "INVALID_ARGUMENT"
  | "DEADLINE_EXCEEDED"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "PERMISSION_DENIED"
  | "RESOURCE_EXHAUSTED"
  | "FAILED_PRECONDITION"
  | "ABORTED"
  | "OUT_OF_RANGE"
  | "UNIMPLEMENTED"
  | "INTERNAL"
  | "UNAVAILABLE"
  | "DATA_LOSS"
  | "UNAUTHENTICATED";

export interface ApiErrorDto {
  status: CallableErrorStatus;
  message: string;
  details?: unknown;
}

export interface ApiErrorOutput {
  error: ApiErrorDto;
}
