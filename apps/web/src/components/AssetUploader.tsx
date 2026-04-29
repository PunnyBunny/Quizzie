import { useEffect, useRef, useState } from "react";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "../lib/firebase";
import { audioStoragePath, imageStoragePath } from "../lib/asset-paths";
import { invalidateStorageUrl, useStorageUrl } from "../hooks/useStorageUrl";
import { toUserMessage } from "../lib/errors";
import { Alert } from "./Alert";
import { useTranslation } from "../i18n/LanguageProvider";

const INPUT_CLASSES =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500";

interface AssetUploaderProps {
  kind: "audio" | "image";
  value: string;
  onChange: (path: string) => void;
  sectionId: string;
  placeholder?: string;
}

export function AssetUploader({
  kind,
  value,
  onChange,
  sectionId,
  placeholder,
}: AssetUploaderProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storagePath =
    value.length > 0
      ? kind === "audio"
        ? audioStoragePath(value)
        : imageStoragePath(value)
      : null;
  const preview = useStorageUrl(freshUrl ? null : storagePath);

  useEffect(() => {
    setFreshUrl(null);
    setError(null);
  }, [value]);

  const handleFile = async (file: File) => {
    const rel = value.length > 0 ? value : `${sectionId || "misc"}/${file.name}`;
    const fullPath = kind === "audio" ? audioStoragePath(rel) : imageStoragePath(rel);
    setUploading(true);
    setError(null);
    try {
      const result = await uploadBytes(storageRef(storage, fullPath), file, {
        contentType: file.type,
      });
      invalidateStorageUrl(fullPath);
      const url = await getDownloadURL(result.ref);
      // Append a cache-buster so a re-upload to the same path doesn't show the
      // stale browser-cached blob.
      setFreshUrl(`${url}${url.includes("?") ? "&" : "?"}_v=${Date.now()}`);
      if (rel !== value) onChange(rel);
    } catch (err) {
      console.error("Asset upload failed:", err);
      setError(toUserMessage(err, t("asset.errorUpload")));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const previewUrl = freshUrl ?? preview.url;

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_CLASSES}
          placeholder={placeholder}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={kind === "audio" ? "audio/*" : "image/*"}
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
          className="text-sm text-gray-700"
        />
      </div>
      {uploading && <p className="text-xs text-gray-500">{t("asset.uploading")}</p>}
      {error && <Alert kind="error">{error}</Alert>}
      {!uploading && previewUrl && (
        <div className="pt-1">
          {kind === "image" ? (
            <img
              src={previewUrl}
              alt={value}
              className="max-h-32 rounded border border-gray-200"
            />
          ) : (
            <audio controls src={previewUrl} className="w-full" />
          )}
        </div>
      )}
      {!uploading && value && !previewUrl && preview.error && (
        <p className="text-xs text-gray-500">{t("asset.noFile")}</p>
      )}
    </div>
  );
}
