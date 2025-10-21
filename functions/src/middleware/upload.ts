import multer from "multer";

// Multer (in-memory) for handling file uploads
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});
