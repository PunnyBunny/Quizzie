export const QUESTION_AUDIO_PREFIX = "question-assets/audios";
export const QUESTION_IMAGE_PREFIX = "question-assets/images";

export const audioStoragePath = (rel: string) => `${QUESTION_AUDIO_PREFIX}/${rel}`;
export const imageStoragePath = (rel: string) => `${QUESTION_IMAGE_PREFIX}/${rel}`;
