import { AudioPlayer } from "./AudioPlayer";
import { useEffect, useRef, useState } from "react";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "../lib/firebase";
import { audioStoragePath, imageStoragePath } from "../lib/asset-paths";
import { invalidateStorageUrl, useStorageUrl } from "../hooks/useStorageUrl";
import { toUserMessage } from "../lib/errors";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useTranslation } from "../hooks/useTranslation";

interface AssetUploaderProps {
  kind: "audio" | "image";
  value: string;
  onChange: (path: string) => void;
  sectionId: string;
  label?: string;
  /** Covers uploading and URL lookup; finishes after the new path reaches the form. */
  onUploadingChange?: (uploading: boolean) => void;
}

export function AssetUploader({
  kind,
  value,
  onChange,
  sectionId,
  label,
  onUploadingChange,
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
    // Each selection gets its own path, so replacing a file keeps the saved asset intact.
    const extension = /\.[a-z0-9]+$/i.exec(file.name)?.[0].toLowerCase() ?? "";
    const rel = `${sectionId || "misc"}/${crypto.randomUUID()}${extension}`;
    const fullPath = kind === "audio" ? audioStoragePath(rel) : imageStoragePath(rel);
    setUploading(true);
    onUploadingChange?.(true);
    setError(null);
    try {
      const result = await uploadBytes(storageRef(storage, fullPath), file, {
        contentType: file.type,
      });
      invalidateStorageUrl(fullPath);
      const url = await getDownloadURL(result.ref);
      setFreshUrl(url);
      onChange(rel);
    } catch (err) {
      console.error("Asset upload failed:", err);
      setError(toUserMessage(err, t("asset.errorUpload")));
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const previewUrl = value ? (freshUrl ?? preview.url) : null;
  const uploadLabel = t(value ? "asset.replaceFile" : "asset.uploadFile");

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        aria-label={label ?? t(kind === "audio" ? "asset.audioFile" : "asset.imageFile")}
        accept={kind === "audio" ? "audio/*" : "image/*"}
        disabled={uploading}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          aria-busy={uploading}
          aria-label={`${uploadLabel}: ${label ?? t(kind === "audio" ? "asset.audioFile" : "asset.imageFile")}`}
          onClick={() => fileInputRef.current?.click()}
          className="min-w-32"
        >
          {uploadLabel}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploading}
            aria-label={`${t("common.remove")} ${label ?? t(kind === "audio" ? "asset.audioFile" : "asset.imageFile")}`}
            onClick={() => {
              setFreshUrl(null);
              setError(null);
              onChange("");
            }}
          >
            {t("common.remove")}
          </Button>
        )}
      </div>
      {uploading && (
        <p role="status" className="text-xs text-gray-500">
          {t("asset.uploading")}
        </p>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!uploading && previewUrl && (
        <div className="pt-1">
          {kind === "image" ? (
            <img
              src={previewUrl}
              alt={label ?? t("asset.imagePreview")}
              className="max-h-32 rounded-sm border border-gray-200"
            />
          ) : (
            <AudioPlayer src={previewUrl} label={t("audio.preview")} />
          )}
        </div>
      )}
      {!uploading && value && !previewUrl && preview.error && (
        <p className="text-xs text-gray-500">{t("asset.noFile")}</p>
      )}
    </div>
  );
}
